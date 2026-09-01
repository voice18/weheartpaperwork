import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { router, useLocalSearchParams } from "expo-router";

import { auth } from "../../lib/firebase";
import { savePendingReferralCode } from "../../lib/referrals";

type AuthMode = "login" | "create";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function friendlyAuthError(error: unknown, mode: AuthMode): string {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  if (code === "auth/invalid-credential" || code === "auth/user-not-found" || code === "auth/wrong-password") return "That email and password do not match an existing account.";
  if (code === "auth/email-already-in-use") return "An account already exists for this email. Choose Sign in instead.";
  if (code === "auth/invalid-email") return "Enter a valid email address.";
  if (code === "auth/weak-password") return "Create a password with at least 6 characters.";
  if (code === "auth/too-many-requests") return "Too many attempts. Wait a few minutes and try again.";
  return mode === "create" ? "We could not create your account. Please try again." : "We could not sign you in. Please try again.";
}

export default function Login() {
  const params = useLocalSearchParams<{ ref?: string | string[]; mode?: string | string[] }>();
  const referralCode = firstParam(params.ref);
  const requestedMode: AuthMode = firstParam(params.mode) === "create" ? "create" : "login";
  const [mode, setMode] = useState<AuthMode>(requestedMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    setMode(requestedMode);
    setMessage("");
  }, [requestedMode]);

  useEffect(() => {
    if (!referralCode) return;
    void savePendingReferralCode(referralCode).catch((error) => console.error("Unable to save pending referral code:", error));
  }, [referralCode]);

  const chooseMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setMessage("");
    router.setParams({ mode: nextMode });
  };

  const submit = async () => {
    if (working) return;
    const cleanedEmail = email.trim();
    if (!cleanedEmail || !password) {
      setMessage("Enter your email address and password.");
      return;
    }
    try {
      setWorking(true);
      setMessage(mode === "create" ? "Creating your account…" : "Signing you in…");
      if (mode === "create") await createUserWithEmailAndPassword(auth, cleanedEmail, password);
      else await signInWithEmailAndPassword(auth, cleanedEmail, password);
    } catch (error) {
      setMessage(friendlyAuthError(error, mode));
    } finally {
      setWorking(false);
    }
  };

  const resetPassword = async () => {
    const cleanedEmail = email.trim();
    if (!cleanedEmail) {
      setMessage("Enter your email address first, then choose Forgot password.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, cleanedEmail);
      setMessage("Password reset email sent. Check your inbox.");
    } catch (error) {
      setMessage(friendlyAuthError(error, "login"));
    }
  };

  const creating = mode === "create";

  return (
    <ScrollView
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={styles.page}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.card}>
        <Text style={styles.brand}>WE <Text style={styles.heart}>♥</Text> PAPERWORK</Text>
        <Text style={styles.title}>{creating ? "Create your account" : "Sign in to your account"}</Text>
        <Text style={styles.description}>
          {creating
            ? "Start organizing your company, driver, truck, and trailer deadlines in one place."
            : "Welcome back. Use the email and password for your existing account."}
        </Text>

        <Text style={styles.label}>Email address</Text>
        <TextInput
          accessibilityLabel="Email address"
          placeholder="you@company.com"
          placeholderTextColor="#8A8880"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          style={styles.input}
        />

        <Text style={styles.label}>{creating ? "Create password" : "Password"}</Text>
        <TextInput
          accessibilityLabel={creating ? "Create password" : "Password"}
          placeholder={creating ? "At least 6 characters" : "Enter your password"}
          placeholderTextColor="#8A8880"
          value={password}
          onChangeText={setPassword}
          autoComplete={creating ? "new-password" : "current-password"}
          secureTextEntry
          onSubmitEditing={() => void submit()}
          style={styles.input}
        />
        {creating ? <Text style={styles.passwordHelp}>Use at least 6 characters.</Text> : null}

        <TouchableOpacity accessibilityRole="button" disabled={working} onPress={() => void submit()} style={[styles.primaryButton, working && styles.buttonDisabled]}>
          <Text style={styles.primaryButtonText}>
            {working ? creating ? "Creating account…" : "Signing in…" : creating ? "Create account" : "Sign in"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity accessibilityRole="button" onPress={() => void resetPassword()}>
          <Text style={styles.forgotPassword}>Forgot password?</Text>
        </TouchableOpacity>

        {message ? <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text> : null}

        <View style={styles.switchPanel}>
          <Text style={styles.switchPrompt}>{creating ? "Already have an account?" : "New to We Heart Paperwork?"}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => chooseMode(creating ? "login" : "create")} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>{creating ? "Sign in" : "Create account"}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.version}>v0.1.0 Beta</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, paddingHorizontal: 20, paddingVertical: 40, alignItems: "center", justifyContent: "center", backgroundColor: "#F6F5F1" },
  card: { width: "100%", maxWidth: 430, paddingHorizontal: 28, paddingVertical: 32, borderWidth: 1, borderColor: "#E5E3DA", borderRadius: 18, backgroundColor: "#FAFAF8" },
  brand: { marginBottom: 22, color: "#27500A", fontSize: 13, fontWeight: "800", letterSpacing: 1.2, textAlign: "center" },
  heart: { color: "#C0392B" },
  title: { color: "#1A1915", fontSize: 30, lineHeight: 36, fontWeight: "800", textAlign: "center" },
  description: { marginTop: 10, marginBottom: 28, color: "#706E68", fontSize: 15, lineHeight: 22, textAlign: "center" },
  label: { marginBottom: 7, color: "#45433F", fontSize: 13, fontWeight: "700" },
  input: { minHeight: 50, marginBottom: 16, paddingHorizontal: 14, borderWidth: 1, borderColor: "#C9C7BF", borderRadius: 10, backgroundColor: "#FFFFFF", color: "#25241F", fontSize: 16 },
  passwordHelp: { marginTop: -9, marginBottom: 16, color: "#706E68", fontSize: 12 },
  primaryButton: { minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "#27500A" },
  buttonDisabled: { opacity: 0.65 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  forgotPassword: { paddingVertical: 14, color: "#27500A", fontSize: 13, fontWeight: "700", textAlign: "center" },
  message: { marginTop: 14, color: "#6B4F16", fontSize: 13, lineHeight: 19, textAlign: "center" },
  switchPanel: { marginTop: 24, paddingTop: 22, borderTopWidth: 1, borderTopColor: "#E5E3DA" },
  switchPrompt: { marginBottom: 10, color: "#45433F", fontSize: 14, fontWeight: "600", textAlign: "center" },
  secondaryButton: { minHeight: 46, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#27500A", borderRadius: 10, backgroundColor: "#FFFFFF" },
  secondaryButtonText: { color: "#27500A", fontSize: 15, fontWeight: "800" },
  version: { marginTop: 24, color: "#8A8880", fontSize: 11, textAlign: "center" },
});
