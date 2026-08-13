// app/_layout.tsx
// Root layout — initializes Firebase auth listener and notification routing.

import {
  useCallback,
  useEffect,
  useRef,
} from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Platform } from "react-native";
import {
  doc,
  onSnapshot,
} from "firebase/firestore";
import {
  Stack,
  usePathname,
  useRootNavigationState,
  useRouter,
} from "expo-router";
import * as Notifications from "expo-notifications";
import { onAuthStateChanged } from "firebase/auth";

import { auth, db } from "../lib/firebase";
import { useComplianceStore } from "../store/useComplianceStore";
import {
  hasBillingAccess,
  type CarrierBilling,
} from "../lib/billing";


Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type PendingNotification = {
  alertType: string;
  itemIds: string;
};

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();

const isPublicRoute =
  ["/compliance-guide", "/privacy", "/support"].includes(
    pathname
  ) ||
  (
    Platform.OS === "web" &&
    pathname === "/"
  );

const isAccountRoute =
  pathname === "/account";
  const rootNavigationState = useRootNavigationState();
  const init = useComplianceStore((state) => state.init);

  const pendingNotification = useRef<PendingNotification | null>(null);
  const appReady = useRef(false);
  const componentMounted = useRef(false);

  const navigationReady = Boolean(rootNavigationState?.key);

  const openDashboard = useCallback(() => {
    if (!componentMounted.current || !navigationReady) {
      return;
    }

    const pending = pendingNotification.current;

    if (pending) {
      pendingNotification.current = null;

      router.replace({
        pathname: "/(app)/dashboard",
        params: {
          alertType: pending.alertType,
          itemIds: pending.itemIds,
        },
      });

      return;
    }

    router.replace("/(app)/dashboard");
  }, [navigationReady, router]);

  useEffect(() => {
    componentMounted.current = true;

    return () => {
      componentMounted.current = false;
    };
  }, []);

  useEffect(() => {
  if (!navigationReady) {
  return;
}

if (isPublicRoute) {
  return;
}

  let effectActive = true;
  let carrierUnsubscribe: (() => void) | null = null;

  const unsubscribeAuth = onAuthStateChanged(
    auth,
    (user) => {
      carrierUnsubscribe?.();
      carrierUnsubscribe = null;

      if (
        !effectActive ||
        !componentMounted.current
      ) {
        return;
      }

      if (!user) {
        appReady.current = false;
        router.replace("/(auth)/login");
        return;
      }

        if (isAccountRoute) {
        appReady.current = false;
        return;
      }

const carrierRef = doc(
        db,
        "carriers",
        user.uid
      );

      carrierUnsubscribe = onSnapshot(
        carrierRef,
        async (snapshot) => {
          if (
            !effectActive ||
            !componentMounted.current
          ) {
            return;
          }

          if (!snapshot.exists()) {
            appReady.current = false;

            router.replace("/(onboarding)/company");

            return;
          }

          const carrierData = snapshot.data();

          const companyName =
            typeof carrierData?.companyName ===
            "string"
              ? carrierData.companyName.trim()
              : "";

          if (!companyName) {
            appReady.current = false;

            router.replace("/(onboarding)/company");

            return;
          }

          if (
            carrierData?.onboardingComplete !==
            true
          ) {
            appReady.current = false;

            router.replace(
              "/(onboarding)/notifications"
            );
            return;
          }

          carrierUnsubscribe?.();
          carrierUnsubscribe = null;

          try {
            const billing =
              (carrierData?.billing as CarrierBilling) ??
              null;

            const hasAccess =
              hasBillingAccess(billing);

            if (!hasAccess) {
              appReady.current = false;

              if (Platform.OS === "web") {


                router.replace(
                  "/(app)/subscription-required"
                );
              } else {


                router.replace(
                  "/compliance-guide"
                );
              }

              return;
            }

            await init(user.uid);

            if (
              !effectActive ||
              !componentMounted.current
            ) {
              return;
            }

            appReady.current = true;

            if (pathname === "/settings") {
               return;
              }

            openDashboard();
          } catch (error) {
            console.log(
              "Auth routing error:",
              error
            );

            if (
              !effectActive ||
              !componentMounted.current
            ) {
              return;
            }

            appReady.current = false;

            router.replace("/(auth)/login");
          }
        },
        (error) => {
          console.log(
            "Carrier routing error:",
            error
          );

          if (
            effectActive &&
            componentMounted.current
          ) {
            appReady.current = false;

            router.replace("/(auth)/login");
          }
        }
      );
    }
  );

  return () => {
    effectActive = false;
    carrierUnsubscribe?.();
    unsubscribeAuth();
  };
}, [
  init,
  navigationReady,
  openDashboard,
  router,
  isPublicRoute,
  isAccountRoute,
]);

  useEffect(() => {
    if (!navigationReady) {
      return;
    }

    let effectActive = true;

    const handleNotificationResponse = (
      response: Notifications.NotificationResponse
    ) => {
      if (!effectActive || !componentMounted.current) {
        return;
      }

      const data = response.notification.request.content.data ?? {};

      if (data.screen !== "dashboard") {
        return;
      }

      pendingNotification.current = {
        alertType: String(data.alertType ?? ""),
        itemIds: JSON.stringify(data.itemIds ?? []),
      };

      if (appReady.current) {
        openDashboard();
      }
    };

    const subscription =
      Notifications.addNotificationResponseReceivedListener(
        handleNotificationResponse
      );

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (
          response &&
          effectActive &&
          componentMounted.current
        ) {
          handleNotificationResponse(response);
        }
      })
      .catch((error) => {
        if (effectActive) {
          console.log("Initial notification response error:", error);
        }
      });

    return () => {
      effectActive = false;
      subscription.remove();
    };
  }, [navigationReady, openDashboard]);

  return (
  <SafeAreaProvider>
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
    </Stack>
  </SafeAreaProvider>
);
}