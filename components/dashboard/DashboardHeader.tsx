import {
  View,
  Text,
  TouchableOpacity,
  Linking,
} from "react-native";
import { router } from "expo-router";

type Props = {
  companyName: string;
  usdotNumber: string;
};

export default function DashboardHeader({
  companyName,
  usdotNumber,
}: Props) {
  return (
    <View style={{ marginBottom: 20 }}>
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={{
            fontSize: 22,
            fontWeight: "700",
            color: "#1A1915",
          }}
        >
          {companyName || "Your company"}
        </Text>

        <Text
          style={{
            marginTop: 2,
            fontSize: 12,
            color: "#706E68",
          }}
        >
          {usdotNumber
            ? `USDOT ${usdotNumber}`
            : "USDOT not entered"}
        </Text>

        <View
  style={{
    alignSelf: "flex-start",
    height: 44,
    justifyContent: "center",
    marginTop: 8,
  }}
>
  <TouchableOpacity
    onPress={() => router.push("/(app)/settings")}
    accessibilityRole="button"
    accessibilityLabel="Open settings"
    activeOpacity={0.75}
    hitSlop={{
      top: 7,
      bottom: 7,
      left: 6,
      right: 6,
    }}
    style={{
      height: 30,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: "#D3D1C7",
      borderRadius: 15,
      backgroundColor: "#FFFFFF",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <Text
      style={{
        marginRight: 5,
        fontSize: 14,
        lineHeight: 16,
        color: "#27500A",
      }}
    >
      ⚙
    </Text>

    <Text
      style={{
        fontSize: 13,
        lineHeight: 16,
        fontWeight: "600",
        color: "#27500A",
      }}
    >
      Settings
    </Text>
  </TouchableOpacity>
  </View>
</View>

      <Text
        style={{
          fontSize: 13,
          color: "#B0AEA8",
          marginTop: 8,
        }}
      >
        {new Date().toLocaleDateString("en-US", {
          weekday: "short",
          month: "long",
          day: "numeric",
        })}
      </Text>

      <TouchableOpacity
        onPress={() =>
          Linking.openURL(
            "https://docs.google.com/forms/d/e/1FAIpQLSecfl3bMNdqnF1ifBjPui_ftyz1MFz8vudtqcIuXVTghkugbQ/viewform?usp=dialog"
          )
        }
        style={{
          alignSelf: "flex-start",
          marginTop: 12,
        }}
      >
        <Text
          style={{
            fontSize: 13,
            color: "#185FA5",
            fontWeight: "500",
          }}
        >
          Send Feedback
        </Text>
      </TouchableOpacity>
    </View>
  );
}