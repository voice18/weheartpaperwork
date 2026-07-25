import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";

import {
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import * as Notifications from "expo-notifications";

import Constants from "expo-constants";

import { auth, db } from "../../lib/firebase";

export default function NotificationsOnboarding() {
  const router = useRouter();

  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  const isWeb = Platform.OS === "web";

  const finishOnboarding = async (
    notificationsEnabled: boolean,
    expoPushToken?: string
  ) => {
    const user = auth.currentUser;

    if (!user) {
      setMessage("Please log in again.");
      return;
    }

    await setDoc(
      doc(db, "carriers", user.uid),
      {
        onboardingComplete: true,
        notificationsEnabled,
        expoPushToken: expoPushToken ?? "",
        notificationTokenUpdatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    await setDoc(
      doc(db, "users", user.uid),
      {
        email: user.email ?? "",
        carrierId: user.uid,
        role: "owner",
        notificationsEnabled,
        expoPushToken: expoPushToken ?? "",
        notificationTokenUpdatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    router.replace("/(app)/dashboard");
  };

  const watchMyPaperwork = async () => {
    try {
      setWorking(true);
      setMessage("");

          if (isWeb) {
      await finishOnboarding(false);
      return;
    }

      

      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "Paperwork reminders",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
        });
      }

      const existingPermissions =
        await Notifications.getPermissionsAsync();

      let finalStatus = existingPermissions.status;

      if (finalStatus !== "granted") {
        const requestedPermissions =
          await Notifications.requestPermissionsAsync();

        finalStatus = requestedPermissions.status;
      }

      if (finalStatus !== "granted") {
        setMessage("Notifications were not enabled.");
        return;
      }

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId;

      if (!projectId) {
        setMessage("Expo project ID is missing from the app configuration.");
        return;
      }

      const tokenResponse =
        await Notifications.getExpoPushTokenAsync({
          projectId,
        });

      await finishOnboarding(true, tokenResponse.data);
    } catch (error: any) {
      console.error("Notification onboarding failed:", error);

      setMessage(
        error?.message || "Unable to enable notifications."
      );
    } finally {
      setWorking(false);
    }
  };

  const doItLater = async () => {
    try {
      setWorking(true);
      setMessage("");
      await finishOnboarding(false);
    } catch (error: any) {
      setMessage(
        error?.message || "Unable to finish setup."
      );
    } finally {
      setWorking(false);
    }
  };

  return (
    <View
      style={{
        flex: 1,
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
            marginBottom: 14,
          }}
        >
          {isWeb
      ? "Keep using your dashboard here"
      : "Would you like us to watch your paperwork?"}
        </Text>

          <Text
        style={{
          fontSize: 16,
          color: "#706E68",
          textAlign: "center",
          lineHeight: 24,
          marginBottom: 22,
        }}
      >
        {isWeb
          ? "Push notifications are available through the We Heart Paperwork app on Android and iOS. You can continue using the full dashboard on this computer."
          : "We’ll let you know before:"}
      </Text>

        {!isWeb ? (
        <View style={{ gap: 10, marginBottom: 26 }}>
          <Text style={{ fontSize: 15, color: "#1A1915" }}>
            ✓ Important deadlines
          </Text>

          <Text style={{ fontSize: 15, color: "#1A1915" }}>
            ✓ FMCSA and DOT changes
          </Text>

          <Text style={{ fontSize: 15, color: "#1A1915" }}>
            ✓ Driver renewals
          </Text>

          <Text style={{ fontSize: 15, color: "#1A1915" }}>
            ✓ Company renewals
          </Text>
        </View>
        ) : null}

        <Text
          style={{
            fontSize: 15,
            color: "#706E68",
            textAlign: "center",
            lineHeight: 22,
            marginBottom: 24,
          }}
        >
          So you can focus on keeping your trucks working.
        </Text>

              <TouchableOpacity
        onPress={isWeb ? doItLater : watchMyPaperwork}
        disabled={working}
        style={{
          backgroundColor: "#27500A",
          borderRadius: 14,
          paddingVertical: 15,
          alignItems: "center",
          opacity: working ? 0.6 : 1,
        }}
      >
        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 16,
            fontWeight: "700",
          }}
        >
          {working
            ? "Finishing setup..."
            : isWeb
              ? "Continue to dashboard"
              : "Yes, watch my paperwork"}
        </Text>
      </TouchableOpacity>

              {!isWeb ? (
        <TouchableOpacity
          onPress={doItLater}
          disabled={working}
          style={{
            paddingVertical: 16,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontSize: 14,
              color: "#706E68",
              fontWeight: "600",
            }}
          >
            I’ll do it later
          </Text>
        </TouchableOpacity>
      ) : null}

              {!isWeb ? (
        <Text
          style={{
            fontSize: 11,
            color: "#8A8880",
            textAlign: "center",
          }}
        >
          You can change this anytime.
        </Text>
      ) : null}

        {message ? (
          <Text
            style={{
              fontSize: 12,
              color: "#A32D2D",
              textAlign: "center",
              marginTop: 14,
              lineHeight: 18,
            }}
          >
            {message}
          </Text>
        ) : null}
      </View>
    </View>
  );
}