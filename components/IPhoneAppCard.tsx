import { Platform, StyleSheet, Text, View } from "react-native";
import AppStoreLink from "./public/AppStoreLink";

export default function IPhoneAppCard() {
  if (Platform.OS !== "web") return null;
  return <View style={styles.card}>
    <View style={styles.copy}>
      <Text style={styles.title}>Take your dashboard with you.</Text>
      <Text style={styles.body}>Get We Heart Paperwork for iPhone. Sign in with your existing account to see your records and set up deadline reminders.</Text>
    </View>
    <AppStoreLink prominent />
  </View>;
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 16, padding: 18, marginVertical: 16, borderRadius: 12, borderWidth: 1, borderColor: "#D6E4C9", backgroundColor: "#F2F6ED" },
  copy: { flexGrow: 1, flexShrink: 1, flexBasis: 240 },
  title: { color: "#1A1915", fontSize: 17, fontWeight: "700", marginBottom: 6 },
  body: { color: "#5F5D57", fontSize: 14, lineHeight: 21 },
});
