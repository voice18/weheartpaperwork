import { StyleSheet, Text, View } from "react-native";
import { MANAGED_PRICING } from "../../lib/managedPricing";

export type ManagedCoverage = {
  status?: "draft" | "active" | "paused";
  effectiveDate?: string | null;
  areas?: { company?: boolean; drivers?: boolean; fleet?: boolean };
  managedUnitIds?: { driverIds?: string[]; vehicleIds?: string[] };
};
type Area = "company" | "drivers" | "fleet";
const LABEL: Record<Area, string> = { company: "Company", drivers: "Driver", fleet: "Fleet" };

export default function ManagedCoverageNotice({
  coverage, area, unmanagedCount = 0,
}: { coverage: ManagedCoverage | null; area?: Area; unmanagedCount?: number }) {
  if (!coverage) return null;
  const active = coverage.status === "active";
  if (area) {
    const managed = active && coverage.areas?.[area] === true;
    const awaitingUnits = managed && (area === "drivers" ? !coverage.managedUnitIds?.driverIds?.length
      : area === "fleet" ? !coverage.managedUnitIds?.vehicleIds?.length : false);
    return <View style={[styles.card, managed ? styles.managed : styles.self]}>
      <Text style={styles.title}>{LABEL[area]} · {awaitingUnits ? "No units enrolled yet" : managed ? "Managed with We Heart Paperwork" : "Self-managed"}</Text>
      <Text style={styles.body}>{awaitingUnits
        ? `No ${area === "drivers" ? "drivers" : "trucks or trailers"} are enrolled in managed support yet. App reminders remain available. If you add a unit, we will contact you to confirm the added ${area === "drivers" ? `$${MANAGED_PRICING.driverMonthly} per driver` : "$1 per truck or trailer"} monthly managed charge before taking responsibility for it.`
        : managed
        ? "We monitor the listed deadlines, send instructions, and follow up. You complete filings, payments, reviews, and inspections, then confirm they are done. Custom Company items are included only after we verify and accept their due dates."
        : "Your app reminders remain available. Personal follow-up from We Heart Paperwork is not active for this tab."}</Text>
      {managed && unmanagedCount > 0 && <Text style={styles.body}>{unmanagedCount} newly added {area === "drivers" ? "driver" : "vehicle"}{unmanagedCount === 1 ? " is" : "s are"} tracked in your app but not included in managed support. We will contact you before adding a managed charge or taking responsibility for {unmanagedCount === 1 ? "this unit" : "these units"}.</Text>}
    </View>;
  }
  const areas = (["company", "drivers", "fleet"] as Area[])
    .map(key => LABEL[key] + ": " + (active && coverage.areas?.[key]
      ? key === "drivers" && !coverage.managedUnitIds?.driverIds?.length ||
        key === "fleet" && !coverage.managedUnitIds?.vehicleIds?.length
        ? "no units enrolled yet" : "managed with us"
      : "self-managed"));
  return <View style={styles.card}>
    <Text style={styles.title}>Your tracking coverage{active && coverage.effectiveDate ? " · since " + coverage.effectiveDate : ""}</Text>
    <Text style={styles.body}>{active ? areas.join("   ·   ") : "Managed service is not active. Your app tracking remains available."}</Text>
  </View>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: "#F5F7F0", borderColor: "#CFD8C2", borderWidth: 1,
    borderRadius: 12, padding: 14, marginBottom: 15 },
  managed: { backgroundColor: "#EDF5E6" },
  self: { backgroundColor: "#F6F5F1", borderColor: "#DDDAD0" },
  title: { color: "#27500A", fontSize: 15, fontWeight: "800" },
  body: { color: "#4F5149", fontSize: 13, lineHeight: 19, marginTop: 5 },
});
