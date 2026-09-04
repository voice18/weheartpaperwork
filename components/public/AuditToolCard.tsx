import { Pressable, StyleSheet, Text, View } from "react-native";
import { openStaticTool } from "../../lib/openStaticTool";

const tools = {
  audit: {
    href: "/tools/new-entrant-audit/",
    eyebrow: "FREE NEW ENTRANT TOOL",
    title: "The audit checklist I wish I had.",
    body: "I built this from the New Entrant Safety Audit my own trucking company passed. Organize the requested documents, work through the audit questions, and print a copy for your file.",
    meta: ["10 documents", "17 questions", "No signup"],
    cta: "Open the audit tool →",
  },
  dq: {
    href: "/tools/driver-qualification-file/",
    eyebrow: "FREE DRIVER TOOL",
    title: "Build a clean DQ-file starter packet.",
    body: "Generate the carrier-created forms, organization checklist, and action plan for one driver. The packet explains which official records you still need to obtain and which sensitive records belong somewhere else.",
    meta: ["Built in your browser", "No signup", "Free PDF"],
    cta: "Open the DQ File Builder →",
  },
  maintenance: {
    href: "/tools/vehicle-maintenance-file/",
    eyebrow: "FREE FLEET TOOL",
    title: "Build a clean vehicle maintenance file.",
    body: "Create the identity sheet, preventive-maintenance schedule, repair log, annual-inspection history, and file index for every truck and trailer you control.",
    meta: ["Whole-fleet builder", "Built in your browser", "Free PDF"],
    cta: "Open the maintenance builder →",
  },
  accident: {
    href: "/tools/accident-register/",
    eyebrow: "FREE SAFETY TOOL",
    title: "Build the accident register an auditor expects.",
    body: "Determine whether an occurrence meets the federal accident definition, build the three-year register, and organize the reports supporting every entry.",
    meta: ["Recordability decision", "Built in your browser", "Free PDF"],
    cta: "Open the accident register builder →",
  },
} as const;

export default function AuditToolCard({ tool = "audit" }: { tool?: keyof typeof tools }) {
  const content = tools[tool];
  return (
    <Pressable accessibilityRole="link" onPress={() => openStaticTool(content.href)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <Text style={styles.eyebrow}>{content.eyebrow}</Text>
      <Text style={styles.title}>{content.title}</Text>
      <Text style={styles.body}>{content.body}</Text>
      <View style={styles.metaRow}>
        {content.meta.map((item, index) => <Text key={item} style={styles.meta}>{index ? `·  ${item}` : item}</Text>)}
      </View>
      <Text style={styles.cta}>{content.cta}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    maxWidth: 760,
    minHeight: 230,
    padding: 26,
    borderWidth: 1,
    borderLeftWidth: 5,
    borderColor: "#D6E4C9",
    borderLeftColor: "#27500A",
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
  },
  eyebrow: { color: "#3B6D11", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  title: { marginTop: 12, color: "#1A1915", fontSize: 25, lineHeight: 31, fontWeight: "800" },
  body: { marginTop: 12, color: "#5F5D57", fontSize: 15, lineHeight: 24 },
  metaRow: { marginTop: 18, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  meta: { color: "#706E68", fontSize: 12, fontWeight: "600" },
  dot: { color: "#AAA79E" },
  cta: { marginTop: 18, color: "#27500A", fontSize: 14, fontWeight: "800" },
  pressed: { opacity: 0.72 },
});
