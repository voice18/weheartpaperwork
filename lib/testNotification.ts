import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

export async function sendTestNotification() {
  const callable = httpsCallable(functions, "sendTestNotification");
  const result = await callable();

  return result.data;
}