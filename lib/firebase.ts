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

const firebaseConfig = {
  apiKey: "AIzaSyBSu5O0uUqn76auE4JqOEUoeHG8nljM5Zg",
  authDomain: "dot-compliance-dashboard.firebaseapp.com",
  projectId: "dot-compliance-dashboard",
  storageBucket: "dot-compliance-dashboard.firebasestorage.app",
  messagingSenderId: "1037743970765",
  appId: "1:1037743970765:web:0e49608a3d8cbb10a18c84",
};

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