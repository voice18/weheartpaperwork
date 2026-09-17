import { Platform, StyleSheet, Text, View } from "react-native";
import AppStoreLink from "./public/AppStoreLink";

export default function IPhoneAppCard() {
  if (Platform.OS !== "web") return null;
  return <View style={styles.card}>
    <View style={styles.copy}>
      <Text style={styles.title}>Your mobile companion app</Text>
      <Text style={styles.body}>Already set up on the website? Download the app and sign in with the same email and password to access your records and set up deadline reminders. You do not need a second account.</Text>
    </View>
    <AppStoreLink prominent existingAccount />
  </View>;
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 16, padding: 18, marginVertical: 16, borderRadius: 12, borderWidth: 1, borderColor: "#D6E4C9", backgroundColor: "#F2F6ED" },
  copy: { flexGrow: 1, flexShrink: 1, flexBasis: 240 },
  title: { color: "#1A1915", fontSize: 17, fontWeight: "700", marginBottom: 6 },
  body: { color: "#5F5D57", fontSize: 14, lineHeight: 21 },
});
