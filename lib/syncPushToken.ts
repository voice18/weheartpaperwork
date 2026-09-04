import { Platform } from "react-native";
import { arrayUnion, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "./firebase";
import { registerForPushNotifications } from "./registerPushNotifications";

export async function syncCurrentDevicePushToken(user: User): Promise<void> {
  if (Platform.OS === "web") return;
  const userRef = doc(db, "users", user.uid);
  const snapshot = await getDoc(userRef);
  if (!snapshot.exists() || snapshot.data().notificationsEnabled !== true) return;
  const registration = await registerForPushNotifications();
  if (!registration.success) return;
  await setDoc(userRef, {
    expoPushToken: registration.expoPushToken,
    expoPushTokens: arrayUnion(registration.expoPushToken),
    notificationTokenUpdatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}
