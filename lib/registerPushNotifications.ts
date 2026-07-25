import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";

export type PushRegistrationResult =
  | {
      success: true;
      expoPushToken: string;
    }
  | {
      success: false;
      reason:
        | "web"
        | "permission-denied"
        | "missing-project-id"
        | "token-unavailable";
      message: string;
    };

export async function registerForPushNotifications(): Promise<PushRegistrationResult> {
  if (Platform.OS === "web") {
    return {
      success: false,
      reason: "web",
      message:
        "Push notifications are available through the Android and iOS apps.",
    };
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
    return {
      success: false,
      reason: "permission-denied",
      message:
        "Notification permission was not granted on this device.",
    };
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    return {
      success: false,
      reason: "missing-project-id",
      message:
        "The Expo project ID is missing from the app configuration.",
    };
  }

  const tokenResponse =
    await Notifications.getExpoPushTokenAsync({
      projectId,
    });

  const expoPushToken = tokenResponse.data;

  if (
    typeof expoPushToken !== "string" ||
    !expoPushToken.startsWith("ExponentPushToken[")
  ) {
    return {
      success: false,
      reason: "token-unavailable",
      message:
        "This device did not return a valid notification token.",
    };
  }

  return {
    success: true,
    expoPushToken,
  };
}