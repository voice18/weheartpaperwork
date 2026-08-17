import {
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import SettingsGear from "./SettingsGear";

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
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <View
          style={{
            flex: 1,
            paddingRight: 12,
          }}
        >
          <Text
            numberOfLines={2}
            ellipsizeMode="tail"
            style={{
              fontSize: 22,
              lineHeight: 27,
              fontWeight: "700",
              color: "#1A1915",
              flexShrink: 1,
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
        </View>

        <TouchableOpacity
          onPress={() =>
            router.push("/(app)/settings")
          }
          accessibilityRole="button"
          accessibilityLabel="Open settings"
          activeOpacity={0.55}
          hitSlop={{
            top: 4,
            bottom: 4,
            left: 4,
            right: 4,
          }}
          style={{
            width: 44,
            height: 44,
            marginTop: -4,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <SettingsGear />
        </TouchableOpacity>
      </View>

      <Text
        style={{
          marginTop: 12,
          fontSize: 13,
          color: "#B0AEA8",
        }}
      >
        {new Date().toLocaleDateString(
          "en-US",
          {
            weekday: "short",
            month: "long",
            day: "numeric",
          }
        )}
      </Text>
    </View>
  );
}