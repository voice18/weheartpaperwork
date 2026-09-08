import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { doc, getDoc, getDocFromServer, serverTimestamp, setDoc } from "firebase/firestore";

import { auth, db } from "../../lib/firebase";
import {
  clearPendingReferralCode,
  claimPendingReferral,
  getPendingReferralCode,
} from "../../lib/referrals";

export default function CompanyOnboarding() {
  const router = useRouter();

  const [companyName, setCompanyName] = useState("");
  const [usdotNumber, setUsdotNumber] = useState("");
  const [hasPendingReferral, setHasPendingReferral] = useState(false);
  const [businessUseConfirmed, setBusinessUseConfirmed] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    const loadExistingAccount = async () => {
      const user = auth.currentUser;
      if (!user) {
        if (active) setInitializing(false);
        return;
      }

      try {
        const [carrierSnapshot, pendingReferralCode] = await Promise.all([
          getDoc(doc(db, "carriers", user.uid)),
          getPendingReferralCode(),
        ]);

        if (!active) return;
        const carrierData = carrierSnapshot.data();
        if (typeof carrierData?.companyName === "string") {
          setCompanyName(carrierData.companyName);
        }
        if (typeof carrierData?.usdotNumber === "string") {
          setUsdotNumber(carrierData.usdotNumber);
        }
        setBusinessUseConfirmed(
          carrierData?.businessUseConfirmed === true &&
          carrierData?.businessUseTermsVersion === "2026-09-08"
        );
        setHasPendingReferral(Boolean(pendingReferralCode));
      } catch (error) {
        console.error("Unable to load company onboarding:", error);
        if (active) setMessage("Unable to load your company information. Please try again.");
      } finally {
        if (active) setInitializing(false);
      }
    };

    void loadExistingAccount();
    return () => {
      active = false;
    };
  }, []);

  const continueOnboarding = async () => {
    const user = auth.currentUser;
    const cleanedName = companyName.trim();
    const cleanedUsdot = usdotNumber.replace(/\D/g, "").replace(/^0+/, "");

    if (!user) {
      setMessage("Please log in again.");
      return;
    }

    if (!cleanedName) {
      setMessage("Enter your company name.");
      return;
    }

    if (!businessUseConfirmed) {
      setMessage("Confirm that this account is for a motor-carrier business or organization.");
      return;
    }

    if (hasPendingReferral && !/^\d{1,8}$/.test(cleanedUsdot)) {
      setMessage("Enter a valid USDOT number to claim the pending referral code.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const carrierRef = doc(db, "carriers", user.uid);

      await setDoc(
        carrierRef,
        {
          companyName: cleanedName,
          businessUseConfirmed: true,
          businessUseConfirmedAt: serverTimestamp(),
          businessUseTermsVersion: "2026-09-08",
          ...(hasPendingReferral ? { usdotNumber: cleanedUsdot } : {}),
          onboardingComplete: false,
        },
        { merge: true }
      );

      const savedCarrier = await getDocFromServer(carrierRef);
      if (
        savedCarrier.data()?.businessUseConfirmed !== true ||
        savedCarrier.data()?.businessUseTermsVersion !== "2026-09-08"
      ) {
        throw new Error("Your business confirmation was not saved. Please try again.");
      }

      await claimPendingReferral();

      router.replace("/(onboarding)/notifications");
    } catch (error: any) {
      setMessage(error?.message || "Unable to save your company name.");
    } finally {
      setSaving(false);
    }
  };

  const continueWithoutReferral = async () => {
    try {
      await clearPendingReferralCode();
      setHasPendingReferral(false);
      setMessage("Referral code removed. You can continue without it.");
    } catch (error) {
      console.error("Unable to remove pending referral code:", error);
      setMessage("Unable to remove the referral code. Please try again.");
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
          We Heart Paperwork is sold only to motor-carrier businesses and organizations for business use. A sole proprietor or owner-operator qualifies when operating a motor-carrier business. It is not offered for personal, household, or family use.
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

        {hasPendingReferral ? (
          <>
            <Text style={{ color: "#45433F", fontSize: 13, fontWeight: "700", marginBottom: 7 }}>
              USDOT number for referral verification
            </Text>
            <TextInput
              accessibilityLabel="USDOT number for referral verification"
              placeholder="USDOT number"
              value={usdotNumber}
              onChangeText={value => setUsdotNumber(value.replace(/\D/g, "").slice(0, 8))}
              keyboardType="number-pad"
              returnKeyType="done"
              style={{
                backgroundColor: "#fff",
                borderWidth: 1,
                borderColor: "#D3D1C7",
                borderRadius: 14,
                paddingHorizontal: 14,
                paddingVertical: 14,
                fontSize: 16,
                marginBottom: 8,
              }}
            />
            <Text style={{ color: "#706E68", fontSize: 12, lineHeight: 18, marginBottom: 14 }}>
              The referral program uses USDOT numbers to verify that each participating company is distinct.
            </Text>
          </>
        ) : null}

        <TouchableOpacity
          accessibilityRole="checkbox"
          accessibilityState={{ checked: businessUseConfirmed }}
          onPress={() => setBusinessUseConfirmed(value => !value)}
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            marginBottom: 18,
          }}
        >
          <View
            style={{
              width: 24,
              height: 24,
              marginRight: 10,
              borderWidth: 2,
              borderColor: businessUseConfirmed ? "#27500A" : "#8A8880",
              borderRadius: 5,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: businessUseConfirmed ? "#27500A" : "#FFFFFF",
            }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>
              {businessUseConfirmed ? "✓" : ""}
            </Text>
          </View>
          <Text style={{ flex: 1, color: "#45433F", fontSize: 14, lineHeight: 20 }}>
            I confirm that I am authorized to create and manage this account for the motor-carrier business named above.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={continueOnboarding}
          disabled={saving || initializing || !businessUseConfirmed}
          style={{
            backgroundColor: "#27500A",
            borderRadius: 14,
            paddingVertical: 15,
            alignItems: "center",
            opacity: saving || initializing || !businessUseConfirmed ? 0.6 : 1,
          }}
        >
          {saving || initializing ? (
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

        {hasPendingReferral ? (
          <TouchableOpacity
            accessibilityRole="button"
            disabled={saving}
            onPress={() => void continueWithoutReferral()}
            style={{ paddingVertical: 13, alignItems: "center" }}
          >
            <Text style={{ color: "#706E68", fontSize: 13, fontWeight: "700" }}>
              Continue without referral code
            </Text>
          </TouchableOpacity>
        ) : null}

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
