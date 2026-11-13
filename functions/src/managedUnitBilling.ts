import Stripe from "stripe";

export type ManagedUnitKind = "driver" | "truck" | "trailer";
const names: Record<ManagedUnitKind, string> = {
  driver: "Managed Driver compliance",
  truck: "Managed Truck compliance",
  trailer: "Managed Trailer compliance",
};

function priceId(value: string | { id: string }): string {
  return typeof value === "string" ? value : value.id;
}

function assertOtherItemsMatch(
  subscriptionItems: { price: { id: string }; quantity?: number | null }[],
  phaseItems: { price: string | { id: string }; quantity?: number | null }[],
  targetPriceId: string,
): void {
  const quantities = (items: { price: string | { id: string }; quantity?: number | null }[]) =>
    new Map(items.filter(item => priceId(item.price) !== targetPriceId)
      .map(item => [priceId(item.price), item.quantity ?? 1]));
  const live = quantities(subscriptionItems);
  const scheduled = quantities(phaseItems);
  if (live.size !== scheduled.size || [...live].some(([id, count]) => scheduled.get(id) !== count))
    throw new Error("Current Stripe items differ from the scheduled phase. Reconcile app and managed billing before changing a unit.");
}

export function updatedPhaseItems(
  items: { price: string | { id: string }; quantity?: number | null }[],
  targetPriceId: string, currentCount: number,
): { price: string; quantity: number }[] {
  const target = items.find(item => priceId(item.price) === targetPriceId);
  const present = target?.quantity ?? 0;
  if (present !== currentCount && present !== currentCount + 1)
    throw new Error("Stripe quantity does not match the managed roster. Reconcile billing before adding another unit.");
  const result = items.map(item => ({ price: priceId(item.price), quantity: item.quantity ?? 1 }));
  if (target) {
    const row = result.find(item => item.price === targetPriceId)!;
    row.quantity = currentCount + 1;
  } else result.push({ price: targetPriceId, quantity: 1 });
  return result;
}

export function reducedPhaseItems(
  items: { price: string | { id: string }; quantity?: number | null }[],
  targetPriceId: string, currentCount: number,
): { price: string; quantity: number }[] {
  if (currentCount < 1) throw new Error("There is no managed unit charge to remove.");
  const target = items.find(item => priceId(item.price) === targetPriceId);
  if (!target || (target.quantity ?? 1) !== currentCount)
    throw new Error("Stripe quantity does not match the managed roster. Reconcile billing before removing this unit.");
  return items.filter(item => priceId(item.price) !== targetPriceId)
    .map(item => ({ price: priceId(item.price), quantity: item.quantity ?? 1 }))
    .concat(currentCount > 1 ? [{ price: targetPriceId, quantity: currentCount - 1 }] : []);
}

export async function removeUnitFromManagedBilling(
  stripe: Stripe, subscription: Stripe.Subscription, kind: ManagedUnitKind,
  amountDollars: number, currentCount: number, operationKey: string,
): Promise<string> {
  let matching: Stripe.SubscriptionItem | undefined;
  for (const item of subscription.items.data) {
    if (item.price.unit_amount !== amountDollars * 100 || item.price.recurring?.interval !== "month") continue;
    const productId = typeof item.price.product === "string" ? item.price.product : item.price.product.id;
    if ((await stripe.products.retrieve(productId)).name === names[kind]) { matching = item; break; }
  }
  if (!matching || matching.quantity !== currentCount || currentCount < 1)
    throw new Error("Stripe quantity does not match the managed roster. Reconcile billing before removing this unit.");
  if (currentCount === 1 && subscription.items.data.length === 1)
    throw new Error("This is the last item in a managed-only subscription. End managed support instead of leaving an empty subscription.");
  if (subscription.cancel_at_period_end || subscription.cancel_at || subscription.status !== "active")
    throw new Error("The managed subscription is ending or inactive. Review billing before removing a charge.");
  const targetPriceId = matching.price.id;
  if (subscription.schedule) {
    const scheduleId = typeof subscription.schedule === "string" ? subscription.schedule : subscription.schedule.id;
    const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
    const now = Math.floor(Date.now() / 1000);
    const remaining = schedule.phases.filter(phase => phase.end_date > now);
    if (schedule.status !== "active" || schedule.end_behavior !== "release" || !schedule.current_phase ||
        remaining.length === 0 || remaining.length > 2 ||
        remaining[0].start_date !== schedule.current_phase.start_date)
      throw new Error("The Stripe schedule has an unexpected phase. Review billing before removing this charge.");
    if (remaining.some(phase => phase.discounts?.length || phase.add_invoice_items?.length ||
      phase.default_tax_rates?.length || phase.automatic_tax?.enabled || phase.trial_end ||
      phase.application_fee_percent || phase.billing_thresholds || phase.on_behalf_of ||
      phase.transfer_data || phase.default_payment_method || phase.collection_method === "send_invoice" ||
      phase.items.some(item => item.discounts?.length || item.tax_rates?.length || item.billing_thresholds)))
      throw new Error("The Stripe schedule has custom billing terms. Review them before changing a unit quantity.");
    assertOtherItemsMatch(subscription.items.data, remaining[0].items, targetPriceId);
    if (currentCount === 1 && remaining.some(phase => phase.items.length === 1))
      throw new Error("This is the last item in a managed-only phase. End managed support instead of leaving an empty phase.");
    const phases = remaining.map(phase => ({
      start_date: phase.start_date, end_date: phase.end_date,
      items: reducedPhaseItems(phase.items, targetPriceId, currentCount),
      proration_behavior: "none" as const,
      metadata: { ...subscription.metadata, ...phase.metadata,
        serviceKind: subscription.metadata.serviceKind,
        carrierId: subscription.metadata.carrierId },
    }));
    await stripe.subscriptionSchedules.update(scheduleId, {
      end_behavior: "release", proration_behavior: "none", phases,
    }, { idempotencyKey: `managed_unit_remove_schedule_${operationKey}` });
    const verifiedSchedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
    if (verifiedSchedule.phases.filter(phase => phase.end_date > now).some(phase =>
      (phase.items.find(item => priceId(item.price) === targetPriceId)?.quantity ?? 0) !== currentCount - 1))
      throw new Error("Stripe future phases did not remove the unit charge. Reconcile before changing coverage.");
  } else {
    const items: Stripe.SubscriptionUpdateParams.Item[] = currentCount > 1
      ? [{ id: matching.id, quantity: currentCount - 1 }]
      : [{ id: matching.id, deleted: true }];
    await stripe.subscriptions.update(subscription.id, { items, proration_behavior: "none" },
      { idempotencyKey: `managed_unit_remove_subscription_${operationKey}` });
  }
  const verified = await stripe.subscriptions.retrieve(subscription.id);
  if (verified.status !== "active" || verified.cancel_at_period_end || verified.cancel_at ||
      verified.metadata.serviceKind !== subscription.metadata.serviceKind ||
      verified.metadata.carrierId !== subscription.metadata.carrierId ||
      (verified.items.data.find(item => item.price.id === targetPriceId)?.quantity ?? 0) !== currentCount - 1)
    throw new Error("Stripe did not confirm the reduced managed charge. Reconcile before changing coverage.");
  return targetPriceId;
}

export async function addUnitToManagedBilling(
  stripe: Stripe, subscription: Stripe.Subscription, kind: ManagedUnitKind,
  amountDollars: number, currentCount: number, operationKey: string,
): Promise<string> {
  const name = names[kind];
  let matching: Stripe.SubscriptionItem | undefined;
  for (const item of subscription.items.data) {
    if (item.price.unit_amount !== amountDollars * 100 || item.price.recurring?.interval !== "month") continue;
    const productId = typeof item.price.product === "string" ? item.price.product : item.price.product.id;
    const product = await stripe.products.retrieve(productId);
    if (product.name === name) { matching = item; break; }
  }
  if (matching && matching.quantity !== currentCount && matching.quantity !== currentCount + 1)
    throw new Error("Stripe quantity does not match the managed roster. Reconcile billing first.");
  let schedule: Stripe.SubscriptionSchedule | null = null;
  let remaining: Stripe.SubscriptionSchedule.Phase[] = [];
  if (subscription.schedule) {
    const scheduleId = typeof subscription.schedule === "string" ? subscription.schedule : subscription.schedule.id;
    schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
    if (schedule.status !== "active" || schedule.end_behavior !== "release" || !schedule.current_phase)
      throw new Error("The Stripe schedule is not active. Review billing before adding this unit.");
    const now = Math.floor(Date.now() / 1000);
    remaining = schedule.phases.filter(phase => phase.end_date > now);
    if (remaining.length === 0 || remaining.length > 2 ||
        remaining[0].start_date !== schedule.current_phase.start_date)
      throw new Error("The Stripe schedule has an unexpected phase. Review billing before adding this unit.");
    const appPrices = new Set([subscription.metadata.appCompanyPriceId, subscription.metadata.appDriverPriceId]);
    if (remaining.some(phase => phase.items.length > 0 && phase.items.every(item => appPrices.has(priceId(item.price)))))
      throw new Error("Managed billing is scheduled to end. Do not add a managed unit.");
    if (remaining.some(phase => phase.discounts?.length || phase.add_invoice_items?.length ||
      phase.default_tax_rates?.length || phase.automatic_tax?.enabled || phase.trial_end ||
      phase.application_fee_percent || phase.billing_thresholds || phase.on_behalf_of ||
      phase.transfer_data || phase.default_payment_method || phase.collection_method === "send_invoice" ||
      phase.items.some(item => item.discounts?.length || item.tax_rates?.length || item.billing_thresholds)))
      throw new Error("The Stripe schedule has custom billing terms. Review them before changing a unit quantity.");
  }
  let targetPriceId = matching?.price.id;
  if (!targetPriceId) {
    const product = await stripe.products.create({ name, metadata: { serviceKind: "managed" } },
      { idempotencyKey: `managed_unit_product_${operationKey}` });
    const price = await stripe.prices.create({ product: product.id, currency: "usd",
      unit_amount: amountDollars * 100, recurring: { interval: "month" },
      metadata: { serviceKind: "managed" } },
      { idempotencyKey: `managed_unit_price_${operationKey}` });
    targetPriceId = price.id;
  }
  if (schedule) {
    assertOtherItemsMatch(subscription.items.data, remaining[0].items, targetPriceId!);
    const scheduleId = schedule.id;
    const now = Math.floor(Date.now() / 1000);
    const phases = remaining.map(phase => ({
      start_date: phase.start_date, end_date: phase.end_date,
      items: updatedPhaseItems(phase.items, targetPriceId!, currentCount),
      proration_behavior: "none" as const,
      metadata: { ...subscription.metadata, ...phase.metadata,
        serviceKind: subscription.metadata.serviceKind,
        carrierId: subscription.metadata.carrierId },
    }));
    await stripe.subscriptionSchedules.update(scheduleId, {
      end_behavior: "release", proration_behavior: "none", phases,
    }, { idempotencyKey: `managed_unit_schedule_${operationKey}` });
    const verifiedSchedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
    if (verifiedSchedule.phases.filter(phase => phase.end_date > now).some(phase =>
      !phase.items.some(item => priceId(item.price) === targetPriceId && item.quantity === currentCount + 1)))
      throw new Error("Stripe future phases did not retain the new unit. Reconcile before enrolling.");
  } else if (!matching || matching.quantity !== currentCount + 1) {
    const items: Stripe.SubscriptionUpdateParams.Item[] = matching
      ? [{ id: matching.id, quantity: currentCount + 1 }]
      : [{ price: targetPriceId, quantity: 1 }];
    await stripe.subscriptions.update(subscription.id, { items, proration_behavior: "none" },
      { idempotencyKey: `managed_unit_subscription_${operationKey}` });
  }
  const verified = await stripe.subscriptions.retrieve(subscription.id);
  if (verified.status !== "active" || verified.cancel_at_period_end || verified.cancel_at ||
      verified.metadata.serviceKind !== subscription.metadata.serviceKind ||
      verified.metadata.carrierId !== subscription.metadata.carrierId)
    throw new Error("Managed billing changed during the unit update. Reconcile before enrolling.");
  if (!verified.items.data.some(item => item.price.id === targetPriceId && item.quantity === currentCount + 1))
    throw new Error("Stripe did not show the new unit quantity. Reconcile before enrolling.");
  return targetPriceId;
}
