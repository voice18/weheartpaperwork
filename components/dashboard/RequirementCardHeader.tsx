import { Text, TouchableOpacity, View } from "react-native";

type Props = {
  title: string;
  badge: string;
  badgeColor: string;
  badgeBackground: string;
  summary: string;
  expanded: boolean;
  onToggle: () => void;
  muted?: boolean;
};

/** The same requirement-level entry point in Company, Drivers, and Fleet. */
export default function RequirementCardHeader({
  title,
  badge,
  badgeColor,
  badgeBackground,
  summary,
  expanded,
  onToggle,
  muted = false,
}: Props) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${badge}. ${summary}. ${expanded ? "Hide details" : "Update or view records"}`}
      accessibilityState={{ expanded }}
      activeOpacity={0.8}
      onPress={onToggle}
      style={{ paddingHorizontal: 14, paddingVertical: 13, backgroundColor: muted ? "#F1F1EF" : expanded ? "#F8FAF5" : "#FFFFFF" }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <Text style={{ flex: 1, fontSize: 15, fontWeight: "700", lineHeight: 20, color: muted ? "#77756F" : "#1A1915" }}>
          {title}
        </Text>
        <View style={{ flexShrink: 0, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14, backgroundColor: badgeBackground }}>
          <Text style={{ fontSize: 12, fontWeight: "600", color: badgeColor }}>{badge}</Text>
        </View>
      </View>
      <Text style={{ marginTop: 4, fontSize: 13, lineHeight: 18, color: "#706E68" }}>{summary}</Text>
      <Text style={{ marginTop: 6, fontSize: 13, fontWeight: "700", color: "#27500A" }}>
        {expanded ? "Hide details" : "Update or view records ›"}
      </Text>
    </TouchableOpacity>
  );
}
