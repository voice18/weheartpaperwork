import { useState } from "react";
import { useRouter } from "expo-router";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../lib/firebase";
import { useManagedSupportAvailability } from "../../lib/useManagedSupportAvailability";

/** The web-only first subscription choice. Both paths lead to a single checkout. */
export default function ServiceChoice() {
  const router = useRouter();
  const managedAvailable = useManagedSupportAvailability();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const chooseSelfManaged = async () => {
    if (working) return;
    setWorking(true); setError("");
    try {
      const current = await httpsCallable<Record<string, never>, { quote: { status?: string; signupQuote?: boolean } | null }>(
        functions, "getManagedServiceQuote")({});
      if (current.data.quote?.signupQuote && ["quoted", "accepted"].includes(current.data.quote.status || ""))
        await httpsCallable(functions, "withdrawManagedServiceQuote")({});
      router.replace("/(app)/subscription-required");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not change your signup choice. Please try again.");
    } finally { setWorking(false); }
  };
  return <ScrollView contentContainerStyle={styles.page}>
    <View style={styles.card}>
      <Text style={styles.eyebrow}>SET UP YOUR ACCOUNT</Text>
      <Text style={styles.title}>{managedAvailable ? "How would you like to manage your deadlines?" : "Start tracking your deadlines"}</Text>
      <Text style={styles.body}>{managedAvailable ? "You can use the app yourself or have We Heart Paperwork help manage the areas you choose. You will see the full price before one checkout." : "Use the dashboard, reminders, and records to keep your company, drivers, and equipment organized."}</Text>
      <Pressable accessibilityRole="button" style={styles.option} disabled={working}
        onPress={() => void chooseSelfManaged()}>
        <Text style={styles.optionTitle}>Track it myself</Text>
        <Text style={styles.body}>Use the dashboard, reminders and records yourself. Start with the 14-day app trial.</Text>
      </Pressable>
      {managedAvailable && <Pressable accessibilityRole="button" style={styles.option}
        onPress={() => router.replace("/(app)/managed-tracking" as any)}>
        <Text style={styles.optionTitle}>Have us manage deadlines</Text>
        <Text style={styles.body}>Choose Company, Driver and Fleet support. See your exact app and managed price together. Managed signup has no trial.</Text>
      </Pressable>}
      {Platform.OS !== "web" && <Text style={styles.body}>Complete your company subscription setup at weheartpaperwork.com, then sign in here.</Text>}
      {!!error && <Text style={styles.body}>{error}</Text>}
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 20, backgroundColor: "#F8F7F2" },
  card: { width: "100%", maxWidth: 660, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DDDCD3", borderRadius: 18, padding: 24, gap: 14 },
  eyebrow: { color: "#27500A", fontWeight: "800", letterSpacing: 1 },
  title: { color: "#1A1915", fontSize: 30, fontWeight: "800", lineHeight: 37 },
  body: { color: "#55554F", fontSize: 16, lineHeight: 23 },
  option: { borderWidth: 1, borderColor: "#A6BB92", borderRadius: 14, padding: 18, gap: 5 },
  optionTitle: { color: "#27500A", fontSize: 19, fontWeight: "800" },
});
