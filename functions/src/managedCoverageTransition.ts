export function managedUnitIdsForSave(
  status: "draft" | "active" | "paused",
  continuingActiveCoverage: boolean,
  currentUnitIds: unknown,
  quotedUnitIds: unknown,
): unknown {
  if (continuingActiveCoverage || status !== "active") return currentUnitIds ?? {};
  return quotedUnitIds ?? {};
}
