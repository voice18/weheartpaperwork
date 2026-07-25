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
  onLogout: () => void;
};

export default function DashboardHeader({
  companyName,
  usdotNumber,
  onLogout,
}: Props) {
  return (
    <View style={{ marginBottom: 20 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <View style={{ flex: 1, paddingRight: 12 }}>
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
      </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <TouchableOpacity
            onPress={() => router.push("/(app)/settings")}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderWidth: 1,
              borderColor: "#D3D1C7",
              borderRadius: 6,
            }}
          >
            <Text style={{ fontSize: 12, color: "#706E68" }}>
              Settings
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onLogout}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderWidth: 1,
              borderColor: "#D3D1C7",
              borderRadius: 6,
            }}
          >
            <Text style={{ fontSize: 12, color: "#706E68" }}>
              Logout
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text
        style={{
          fontSize: 13,
          color: "#B0AEA8",
          marginTop: 4,
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