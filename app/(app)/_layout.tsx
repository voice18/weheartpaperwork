import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import {
  CarrierBilling,
  hasBillingAccess,
} from "../../lib/billing";

export default function AppLayout() {
  const pathname = usePathname();

  const [billingLoaded, setBillingLoaded] =
    useState(false);

  const [billing, setBilling] =
    useState<CarrierBilling | null>(null);

  useEffect(() => {
    const user = auth.currentUser;

    if (!user) {
      setBilling(null);
      setBillingLoaded(true);
      return;
    }

    const carrierRef = doc(
      db,
      "carriers",
      user.uid
    );

    const unsubscribe = onSnapshot(
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

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!billingLoaded) {
      return;
    }

    const hasAccess = hasBillingAccess(billing);

    const isSubscriptionPage =
      pathname.endsWith("/subscription-required");

    if (
      !hasAccess &&
      !isSubscriptionPage
    ) {
      router.replace(
        "/(app)/subscription-required"
      );

      return;
    }

    if (hasAccess && isSubscriptionPage) {
      router.replace("/(app)/dashboard");
    }
  }, [billing, billingLoaded, pathname]);

  if (!billingLoaded) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" />

        <Text style={styles.loadingText}>
          Checking subscription…
        </Text>
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