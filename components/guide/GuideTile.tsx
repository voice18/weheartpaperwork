import {
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import type {
  ComplianceGuideEntry,
} from "../../lib/complianceGuide";

type Props = {
  entry: ComplianceGuideEntry;
  onPress: () => void;
};

export default function GuideTile({
  entry,
  onPress,
}: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        width: "48%",
        minHeight: 126,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#E2E0D8",
        borderRadius: 16,
        padding: 14,
        justifyContent: "space-between",
        marginBottom: 12,
      }}
    >
      <View
        style={{
          width: 46,
          height: 46,
          borderRadius: 13,
          backgroundColor: "#EAF3DE",
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: "#C0DD97",
        }}
      >
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{
            maxWidth: 36,
            fontSize: 13,
            fontWeight: "800",
            color: "#27500A",
            textAlign: "center",
          }}
        >
          {entry.iconText}
        </Text>
      </View>

      <View style={{ marginTop: 14 }}>
        <Text
          numberOfLines={2}
          style={{
            fontSize: 14,
            lineHeight: 18,
            fontWeight: "700",
            color: "#1A1915",
          }}
        >
          {entry.shortTitle}
        </Text>

        <Text
          numberOfLines={1}
          style={{
            marginTop: 4,
            fontSize: 11,
            color: "#706E68",
          }}
        >
          See how it works ›
        </Text>
      </View>
    </TouchableOpacity>
  );
}