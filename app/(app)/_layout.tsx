import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Stack,
  router,
  usePathname,
} from "expo-router";
import {
  doc,
  onSnapshot,
} from "firebase/firestore";

import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  CarrierBilling,
  hasBillingAccess,
} from "../../lib/billing";

export default function AppLayout() {
  const pathname = usePathname();

  const [isAuthenticated, setIsAuthenticated] =
  useState(false);
  const [billingLoaded, setBillingLoaded] =
    useState(false);

  const [billing, setBilling] =
    useState<CarrierBilling | null>(null);

  useEffect(() => {
  let unsubscribeCarrier:
    | (() => void)
    | null = null;

  const unsubscribeAuth = onAuthStateChanged(
    auth,
    (user) => {
      unsubscribeCarrier?.();
      unsubscribeCarrier = null;

      if (!user) {
        setIsAuthenticated(false);
        setBilling(null);
        setBillingLoaded(true);
        return;
      }

      setIsAuthenticated(true);
      setBillingLoaded(false);

      const carrierRef = doc(
        db,
        "carriers",
        user.uid
      );

      unsubscribeCarrier = onSnapshot(
        carrierRef,
        (snapshot) => {
          const carrierData = snapshot.data();

          setBilling(
            (carrierData?.billing as CarrierBilling) ??
              null
          );

          setBillingLoaded(true);
        },
        (error) => {
          console.error(
            "Unable to read carrier billing:",
            error
          );

          setBilling(null);
          setBillingLoaded(true);
        }
      );
    }
  );

  return () => {
    unsubscribeCarrier?.();
    unsubscribeAuth();
  };
}, []);

  useEffect(() => {
  if (!billingLoaded) {
    return;
  }

  if (!isAuthenticated) {
    router.replace("/(auth)/login");
    return;
  }

  const hasAccess =
    hasBillingAccess(billing);

const isSubscriptionPage =
  pathname.endsWith(
    "/subscription-required"
  );

if (!hasAccess) {
  if (Platform.OS === "web") {
    if (!isSubscriptionPage) {
      router.replace(
        "/(app)/subscription-required"
      );
    }
  } else {
    router.replace(
      "/compliance-guide"
    );
  }

  return;
}

if (hasAccess && isSubscriptionPage) {
  router.replace(
    "/(app)/dashboard"
  );
}
  }, [billing, billingLoaded, isAuthenticated, pathname]);

  if (!billingLoaded || !isAuthenticated) {
  return (
    <View style={styles.loadingScreen}>
      <ActivityIndicator size="large" />
    </View>
  );
}

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F6F8",
    paddingHorizontal: 24,
  },

  loadingText: {
    marginTop: 14,
    fontSize: 15,
    color: "#68707C",
  },
});