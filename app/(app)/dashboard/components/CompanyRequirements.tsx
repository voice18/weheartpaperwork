import {
  View,
  Text,
} from "react-native";
import RequirementRow from "./RequirementRow";

export default function CompanyRequirements({
  items,
  onSave,
  onComplete,
  onUndo,
  onSetUsdot,
  onSetApplicable,
}: any) {
  if (items.length === 0) {
    return (
      <View
        style={{
          backgroundColor: "#F1EFF8",
          borderRadius: 10,
          padding: 20,
          alignItems: "center",
        }}
      >
        <Text
          style={{
            fontSize: 16,
            fontWeight: "600",
            color: "#1A1915",
          }}
        >
          All clear ✓
        </Text>

        <Text
          style={{
            fontSize: 13,
            color: "#706E68",
            marginTop: 4,
          }}
        >
          No items require attention right now.
        </Text>
      </View>
    );
  }

  return (
    <View>
      {items.map((r: any) => (
        <RequirementRow
          key={r.id}
          r={r}
          onSave={onSave}
          onComplete={onComplete}
          onUndo={onUndo}
          onSetUsdot={onSetUsdot}
          onSetApplicable={
            onSetApplicable
          }
        />
      ))}
    </View>
  );
}