import { StyleSheet, Text, View } from "react-native";

export type ManagedCoverage = {
  status?: "draft" | "active" | "paused";
  effectiveDate?: string | null;
  areas?: { company?: boolean; drivers?: boolean; fleet?: boolean };
};
type Area = "company" | "drivers" | "fleet";
const LABEL: Record<Area, string> = { company: "Company", drivers: "Driver", fleet: "Fleet" };

export default function ManagedCoverageNotice({
  coverage, area,
}: { coverage: ManagedCoverage | null; area?: Area }) {
  if (!coverage) return null;
  const active = coverage.status === "active";
  if (area) {
    const managed = active && coverage.areas?.[area] === true;
    return <View style={[styles.card, managed ? styles.managed : styles.self]}>
      <Text style={styles.title}>{LABEL[area]} · {managed ? "Managed with We Heart Paperwork" : "Self-managed"}</Text>
      <Text style={styles.body}>{managed
        ? "We monitor the listed deadlines, send instructions, and follow up. You complete filings, payments, reviews, and inspections, then confirm they are done. Custom Company items are included only after we verify and accept their due dates."
        : "Your app reminders remain available. Personal follow-up from We Heart Paperwork is not active for this tab."}</Text>
    </View>;
  }
  const areas = (["company", "drivers", "fleet"] as Area[])
    .map(key => LABEL[key] + ": " + (active && coverage.areas?.[key] ? "managed with us" : "self-managed"));
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
