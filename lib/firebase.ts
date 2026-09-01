import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
  type Auth,
} from "firebase/auth";
import { getFunctions } from "firebase/functions";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const productionFirebaseConfig = {
  apiKey: "AIzaSyBSu5O0uUqn76auE4JqOEUoeHG8nljM5Zg",
  authDomain: "dot-compliance-dashboard.firebaseapp.com",
  projectId: "dot-compliance-dashboard",
  storageBucket: "dot-compliance-dashboard.firebasestorage.app",
  messagingSenderId: "1037743970765",
  appId: "1:1037743970765:web:0e49608a3d8cbb10a18c84",
};

const stagingFirebaseConfig = {
  apiKey: "AIzaSyC8FwEn8jI4Mw7EOcHeomVZHaZfFn-VcGI",
  authDomain: "weheartpaperwork-staging.firebaseapp.com",
  projectId: "weheartpaperwork-staging",
  storageBucket: "weheartpaperwork-staging.firebasestorage.app",
  messagingSenderId: "672173656801",
  appId: "1:672173656801:web:9e1f2a3525a416f23d45a0",
};

export const appEnvironment =
  process.env.EXPO_PUBLIC_APP_ENV === "staging" ? "staging" : "production";

export const isStaging = appEnvironment === "staging";

const firebaseConfig = isStaging
  ? stagingFirebaseConfig
  : productionFirebaseConfig;

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let authInstance: Auth;

if (Platform.OS === "web") {
  authInstance = getAuth(app);
} else {
  try {
    authInstance = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // Handles development hot reload if Auth was already initialized.
    authInstance = getAuth(app);
  }
}

export const db = getFirestore(app);
export const auth = authInstance;
export const functions = getFunctions(app, "us-central1");
