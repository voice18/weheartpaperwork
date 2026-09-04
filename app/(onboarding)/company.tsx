import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { doc, setDoc } from "firebase/firestore";

import { auth, db } from "../../lib/firebase";
import {
  claimPendingReferral,
} from "../../lib/referrals";

export default function CompanyOnboarding() {
  const router = useRouter();

  const [companyName, setCompanyName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const continueOnboarding = async () => {
    const user = auth.currentUser;
    const cleanedName = companyName.trim();

    if (!user) {
      setMessage("Please log in again.");
      return;
    }

    if (!cleanedName) {
      setMessage("Enter your company name.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      await setDoc(
        doc(db, "carriers", user.uid),
        {
          companyName: cleanedName,
          onboardingComplete: false,
        },
        { merge: true }
      );

      await claimPendingReferral();

      router.replace("/(onboarding)/notifications");
    } catch (error: any) {
      setMessage(error?.message || "Unable to save your company name.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        flexGrow: 1,
        backgroundColor: "#FAFAF8",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 24,
        paddingVertical: 40,
      }}
    >
      <View style={{ width: "100%", maxWidth: 390 }}>
        <Text
          style={{
            fontSize: 13,
            fontWeight: "800",
            letterSpacing: 1.2,
            color: "#27500A",
            textAlign: "center",
            marginBottom: 18,
          }}
        >
          WE <Text style={{ color: "#C0392B" }}>♥</Text> PAPERWORK
        </Text>

        <Text
          style={{
            fontSize: 34,
            fontWeight: "800",
            color: "#1A1915",
            textAlign: "center",
            lineHeight: 40,
            marginBottom: 12,
          }}
        >
          Let’s get your company set up.
        </Text>

        <Text
          style={{
            fontSize: 16,
            color: "#706E68",
            textAlign: "center",
            lineHeight: 24,
            marginBottom: 30,
          }}
        >
          What’s your company called?
        </Text>

        <TextInput
          placeholder="Company name"
          value={companyName}
          onChangeText={setCompanyName}
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={continueOnboarding}
          style={{
            backgroundColor: "#fff",
            borderWidth: 1,
            borderColor: "#D3D1C7",
            borderRadius: 14,
            paddingHorizontal: 14,
            paddingVertical: 14,
            fontSize: 16,
            marginBottom: 14,
          }}
        />

        <TouchableOpacity
          onPress={continueOnboarding}
          disabled={saving}
          style={{
            backgroundColor: "#27500A",
            borderRadius: 14,
            paddingVertical: 15,
            alignItems: "center",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text
              style={{
                color: "#fff",
                fontSize: 16,
                fontWeight: "800",
              }}
            >
              Continue →
            </Text>
          )}
        </TouchableOpacity>

        {message ? (
          <Text
            style={{
              fontSize: 12,
              color: "#A32D2D",
              textAlign: "center",
              marginTop: 12,
            }}
          >
            {message}
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
}
