export function isManagedSubscription(value: { metadata?: Record<string, string> | null }): boolean {
  return value.metadata?.serviceKind === "managed";
}

export function isLiveAppSubscription(value: { status: string; metadata?: Record<string, string> | null }): boolean {
  return !isManagedSubscription(value) &&
    ["active", "trialing", "past_due", "unpaid", "incomplete", "paused"].includes(value.status);
}
