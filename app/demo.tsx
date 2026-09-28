import { useState } from "react";
import { Link } from "expo-router";
import Head from "expo-router/head";
import { httpsCallable } from "firebase/functions";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import PublicHeader from "../components/public/PublicHeader";
import PublicFooter from "../components/public/PublicFooter";
import { functions } from "../lib/firebase";

export default function DemoPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (busy) return;
    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanAddress = address.trim();
    if (cleanName.length < 2) return setError("Enter your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return setError("Enter a valid email address.");
    if (cleanAddress.length < 5) return setError("Enter your company address.");
    setError("");
    setBusy(true);
    try {
      await httpsCallable(functions, "submitDemoRequest")({
        name: cleanName,
        email: cleanEmail,
        address: cleanAddress,
        phone: phone.trim(),
        website,
      });
      setSent(true);
    } catch (caught: any) {
      const code = String(caught?.code || "");
      setError(code.includes("resource-exhausted")
        ? "Please try again later or email us directly."
        : code.includes("invalid-argument")
          ? String(caught?.message || "Check the information and try again.")
          : "We couldn't send your request right now. Please try again or email us directly.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Head>
        <title>Request a Demo | We Heart Paperwork</title>
        <meta name="description" content="See how We Heart Paperwork helps trucking companies organize DOT compliance deadlines and records. Request a personal demo." />
        <link rel="canonical" href="https://weheartpaperwork.com/demo" />
        <meta name="robots" content="index,follow" />
      </Head>
      <SafeAreaView edges={["top", "bottom"]} style={styles.page}>
        <PublicHeader />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.eyebrow}>SEE IT IN ACTION</Text>
            <Text accessibilityRole="header" style={styles.title}>Request a demo</Text>
            <Text style={styles.intro}>
              Tell me how to reach you and I’ll show you how We Heart Paperwork handles company, driver, and vehicle deadlines. No account or payment is needed to request a demo.
            </Text>

            {sent ? (
              <View style={styles.success} accessibilityLiveRegion="polite">
                <Text style={styles.successTitle}>Your request is in.</Text>
                <Text style={styles.successText}>Thank you. I’ll follow up at {email.trim()} to arrange a time.</Text>
              </View>
            ) : (
              <View style={styles.form}>
                <Text style={styles.label}>Your name *</Text>
                <TextInput accessibilityLabel="Your name" style={styles.input} value={name} onChangeText={setName} autoCapitalize="words" autoComplete="name" maxLength={100} editable={!busy} />

                <Text style={styles.label}>Email address *</Text>
                <TextInput accessibilityLabel="Email address" style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" maxLength={254} editable={!busy} />

                <Text style={styles.label}>Company address *</Text>
                <TextInput accessibilityLabel="Company address" style={styles.input} value={address} onChangeText={setAddress} autoCapitalize="words" autoComplete="street-address" placeholder="Street, city, state, ZIP" placeholderTextColor="#8A8880" maxLength={250} editable={!busy} />

                <Text style={styles.label}>Phone number <Text style={styles.optional}>(optional)</Text></Text>
                <TextInput accessibilityLabel="Phone number, optional" style={styles.input} value={phone} onChangeText={setPhone} autoComplete="tel" keyboardType="phone-pad" maxLength={40} editable={!busy} />

                <View style={styles.honeypot} accessible={false}>
                  <TextInput accessibilityLabel="Leave this field blank" value={website} onChangeText={setWebsite} autoComplete="off" />
                </View>

                {!!error && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}
                <Pressable accessibilityRole="button" accessibilityLabel="Send demo request" disabled={busy} onPress={() => void submit()} style={[styles.submit, busy && styles.disabled]}>
                  <Text style={styles.submitText}>{busy ? "Sending…" : "Request my demo"}</Text>
                </Pressable>
                <Text style={styles.privacyNote}>
                  We’ll use these details to respond to your request. See our <Link href="/privacy" style={styles.privacyLink}>Privacy Policy</Link>.
                </Text>
              </View>
            )}
            <Text style={styles.contact}>Prefer to reach me directly? <Link href="mailto:aaron@weheartpaperwork.com?subject=Demo%20request" style={styles.privacyLink}>Email Aaron</Link>.</Text>
          </View>
          <PublicFooter />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#FAFAF8" },
  content: { paddingBottom: 60 },
  card: { width: "100%", maxWidth: 720, alignSelf: "center", paddingHorizontal: 24, paddingTop: 56, paddingBottom: 72 },
  eyebrow: { color: "#3B6D11", fontSize: 12, fontWeight: "800", letterSpacing: 1.2 },
  title: { color: "#1A1915", fontSize: 44, lineHeight: 50, fontWeight: "800", marginTop: 10 },
  intro: { color: "#5F5D57", fontSize: 17, lineHeight: 27, marginTop: 18 },
  form: { marginTop: 30 },
  label: { color: "#1A1915", fontSize: 14, fontWeight: "700", marginTop: 20, marginBottom: 8 },
  optional: { color: "#706E68", fontWeight: "400" },
  input: { minHeight: 48, borderWidth: 1, borderColor: "#C9C7BE", borderRadius: 10, paddingHorizontal: 14, backgroundColor: "#FFFFFF", color: "#1A1915", fontSize: 16 },
  honeypot: { display: "none" },
  submit: { minHeight: 50, borderRadius: 10, backgroundColor: "#27500A", alignItems: "center", justifyContent: "center", marginTop: 26, paddingHorizontal: 20 },
  disabled: { opacity: 0.6 },
  submitText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  error: { color: "#A32D2D", fontSize: 14, lineHeight: 20, marginTop: 18 },
  privacyNote: { color: "#706E68", fontSize: 13, lineHeight: 20, marginTop: 16 },
  privacyLink: { color: "#27500A", fontWeight: "700" },
  contact: { color: "#706E68", fontSize: 14, lineHeight: 22, marginTop: 28 },
  success: { marginTop: 32, padding: 24, borderRadius: 14, backgroundColor: "#ECF4E5", borderWidth: 1, borderColor: "#B8CFA7" },
  successTitle: { color: "#27500A", fontSize: 22, fontWeight: "800" },
  successText: { color: "#31551A", fontSize: 16, lineHeight: 24, marginTop: 8 },
});
