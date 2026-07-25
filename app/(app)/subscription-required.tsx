import React, {
  useEffect,
  useState,
} from "react";
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  doc,
  onSnapshot,
} from "firebase/firestore";
import { router } from "expo-router";
import { signOut } from "firebase/auth";
import * as Linking from "expo-linking";
import { httpsCallable } from "firebase/functions";

import {
  auth,
  db,
  functions,
} from "../../lib/firebase";

export default function SubscriptionRequiredScreen() {
  const [isStartingTrial, setIsStartingTrial] =
    useState(false);
  const [hasUsedTrial, setHasUsedTrial] =
  useState(false);

  const [billingStatus, setBillingStatus] =
  useState<string | null>(null);

  const [isBillingLoading, setIsBillingLoading] =
  useState(true);
useEffect(() => {
  const user = auth.currentUser;

  if (!user) {
    setIsBillingLoading(false);
    return;
  }

  const userRef = doc(
    db,
    "users",
    user.uid
  );

  let unsubscribeCarrier:
    | (() => void)
    | null = null;

  const unsubscribeUser = onSnapshot(
    userRef,
    (userSnapshot) => {
      const carrierId =
        userSnapshot.data()?.carrierId;

      if (
        !carrierId ||
        typeof carrierId !== "string"
      ) {
        setIsBillingLoading(false);
        return;
      }

      unsubscribeCarrier?.();

      const carrierRef = doc(
        db,
        "carriers",
        carrierId
      );

      unsubscribeCarrier = onSnapshot(
        carrierRef,
        (carrierSnapshot) => {
          const billing =
            carrierSnapshot.data()?.billing;

          const trialPreviouslyUsed =
            billing?.hasUsedTrial === true ||
            billing?.trialEndsAt != null;

          setHasUsedTrial(
            trialPreviouslyUsed
          );

          setBillingStatus(
            typeof billing?.status === "string"
              ? billing.status
              : null
          );

          setIsBillingLoading(false);
        },
        (error) => {
          console.error(
            "Unable to read carrier billing:",
            error
          );

          setIsBillingLoading(false);
        }
      );
    },
    (error) => {
      console.error(
        "Unable to read user account:",
        error
      );

      setIsBillingLoading(false);
    }
  );

  return () => {
    unsubscribeUser();
    unsubscribeCarrier?.();
  };
}, []);

    const isPastDue =
  billingStatus === "past_due" ||
  billingStatus === "unpaid";

const planTitle = hasUsedTrial
  ? isPastDue
    ? "Restore access to your dashboard"
    : "Restart your subscription"
  : "Manage your compliance with confidence";

const planDescription = hasUsedTrial
  ? isPastDue
    ? "We could not process your previous payment. Continue to Stripe to update your payment information and restore access."
    : "Your previous subscription has ended. Restart your subscription to regain access to your compliance dashboard."
  : "Start with a 14-day free trial. After the trial, the dashboard is $10 per month plus $2 per active driver.";

const checkoutButtonLabel = hasUsedTrial
  ? isPastDue
    ? "Restore Subscription"
    : "Restart Subscription"
  : "Start 14-day free trial";

const billingNote = hasUsedTrial
  ? "$10 per month plus $2 per active driver. Billing begins immediately."
  : "A payment method is required. You can manage or cancel your subscription through the app.";

  async function handleLogout() {
    try {
      await signOut(auth);
      router.replace("/(auth)/login");
    } catch (error) {
      console.error("Unable to log out:", error);

      Alert.alert(
        "Unable to log out",
        "Please try again."
      );
    }
  }

  async function handleCheckout() {
    if (isStartingTrial) {
      return;
    }

    try {
      setIsStartingTrial(true);

      const createCheckoutSession = httpsCallable<
        Record<string, never>,
        {
          url: string;
          activeDriverCount: number;
          estimatedMonthlyAmountCents: number;
        }
      >(
        functions,
        "createCheckoutSession"
      );

      const result =
        await createCheckoutSession({});

      const {
        url,
        activeDriverCount,
        estimatedMonthlyAmountCents,
      } = result.data;

      if (!url) {
        throw new Error(
          "Stripe did not return a Checkout URL."
        );
      }

      console.log(
        "Checkout session returned:",
        {
          activeDriverCount,
          estimatedMonthlyAmountCents,
          url,
        }
      );

      await Linking.openURL(url);
    } catch (error: any) {
      console.error(
        "Unable to open checkout:",
        error
      );

      const message =
        typeof error?.details === "string"
          ? error.details
          : typeof error?.message === "string"
            ? error.message
            : "Checkout is not available right now.";

      Alert.alert(
      "Unable to open checkout",
      message
    );
    } finally {
      setIsStartingTrial(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={
          styles.scrollContent
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <View style={styles.heroCard}>
            <Text style={styles.eyebrow}>
              WE HEART PAPERWORK
            </Text>

            <Text style={styles.title}>
              Keep your trucks working.
            </Text>

            <Text style={styles.subtitle}>
              Not your evenings buried in paperwork.
            </Text>

            <Text style={styles.description}>
              Running a trucking company is hard
              enough without worrying about missed
              DOT paperwork. We Heart Paperwork
              helps organize company and driver
              compliance so you know what is due,
              what is coming next, and what needs
              attention.
            </Text>
          </View>

          <View style={styles.videoCard}>
            <View style={styles.playIcon}>
              <Text style={styles.playIconText}>
                ▶
              </Text>
            </View>

            <View style={styles.videoTextContainer}>
              <Text style={styles.videoTitle}>
                Watch why this matters
              </Text>

              <Text style={styles.videoDescription}>
                A short explanation of why trucking
                companies need a reliable compliance
                system.
              </Text>

              <Text style={styles.videoComingSoon}>
                Video coming soon
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              What you get
            </Text>

            <View style={styles.benefitsCard}>
              <BenefitRow
                title="Company compliance"
                description="See company requirements and deadlines in one place."
              />

              <BenefitRow
                title="Driver compliance"
                description="Track requirements and records for each active driver."
              />

              <BenefitRow
                title="Deadline monitoring"
                description="Know what is approaching before it becomes overdue."
              />

              <BenefitRow
                title="Audit readiness"
                description="Keep important compliance information organized and accessible."
                showDivider={false}
              />
            </View>
          </View>

          <View style={styles.planCard}>
            <Text style={styles.planLabel}>
              COMPLIANCE DASHBOARD
            </Text>

            <Text style={styles.planTitle}>
            {planTitle}
          </Text>

            <Text style={styles.planDescription}>
            {isBillingLoading
              ? "Checking your subscription..."
              : planDescription}
          </Text>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                (isStartingTrial ||
            isBillingLoading) &&
            styles.primaryButtonDisabled,
              ]}
              onPress={handleCheckout}
              activeOpacity={0.85}
              disabled={
                isStartingTrial ||
                isBillingLoading
              }
            >
              <Text style={styles.primaryButtonText}>
                {isBillingLoading
                ? "Checking subscription..."
                : isStartingTrial
                  ? "Preparing checkout..."
                  : checkoutButtonLabel}
              </Text>
            </TouchableOpacity>

            <Text style={styles.billingNote}>
              {billingNote}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.managedCard}
            onPress={() =>
              router.push(
                "/(app)/fully-managed"
              )
            }
            activeOpacity={0.8}
          >
            <Text style={styles.managedEyebrow}>
              NEED MORE HELP?
            </Text>

            <Text style={styles.managedTitle}>
              Prefer fully managed compliance?
            </Text>

            <Text style={styles.managedDescription}>
              Learn how our team can help monitor
              company and driver requirements for
              you.
            </Text>

            <Text style={styles.managedLink}>
              Learn about fully managed compliance →
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.75}
          >
            <Text style={styles.logoutButtonText}>
              Log out
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type BenefitRowProps = {
  title: string;
  description: string;
  showDivider?: boolean;
};

function BenefitRow({
  title,
  description,
  showDivider = true,
}: BenefitRowProps) {
  return (
    <View
      style={[
        styles.benefitRow,
        showDivider && styles.benefitDivider,
      ]}
    >
      <View style={styles.checkCircle}>
        <Text style={styles.checkMark}>
          ✓
        </Text>
      </View>

      <View style={styles.benefitTextContainer}>
        <Text style={styles.benefitTitle}>
          {title}
        </Text>

        <Text style={styles.benefitDescription}>
          {description}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F5F6F8",
  },

  scrollContent: {
    flexGrow: 1,
    paddingVertical: 24,
  },

  container: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    paddingHorizontal: 20,
  },

  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 30,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },

  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.3,
    color: "#68707C",
    marginBottom: 14,
  },

  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    color: "#171A1F",
  },

  subtitle: {
    fontSize: 22,
    lineHeight: 29,
    fontWeight: "700",
    color: "#4F6338",
    marginTop: 4,
  },

  description: {
    fontSize: 16,
    lineHeight: 25,
    color: "#5E6672",
    marginTop: 20,
  },

  videoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECEFE8",
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
  },

  playIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#171A1F",
    marginRight: 16,
  },

  playIconText: {
    color: "#FFFFFF",
    fontSize: 17,
    marginLeft: 2,
  },

  videoTextContainer: {
    flex: 1,
  },

  videoTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#252A31",
  },

  videoDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: "#68707C",
    marginTop: 4,
  },

  videoComingSoon: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4F6338",
    marginTop: 8,
  },

  section: {
    marginTop: 26,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#171A1F",
    marginBottom: 12,
  },

  benefitsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 20,
  },

  benefitRow: {
    flexDirection: "row",
    paddingVertical: 18,
  },

  benefitDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#D9DDE3",
  },

  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#E8EEE2",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
    marginTop: 1,
  },

  checkMark: {
    fontSize: 15,
    fontWeight: "800",
    color: "#4F6338",
  },

  benefitTextContainer: {
    flex: 1,
  },

  benefitTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#252A31",
  },

  benefitDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: "#68707C",
    marginTop: 3,
  },

  planCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    marginTop: 26,
    borderWidth: 1,
    borderColor: "#D9DDE3",
  },

  planLabel: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.1,
    color: "#4F6338",
  },

  planTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    color: "#171A1F",
    marginTop: 9,
  },

  planDescription: {
    fontSize: 15,
    lineHeight: 23,
    color: "#5E6672",
    marginTop: 10,
    marginBottom: 22,
  },

  primaryButton: {
    minHeight: 54,
    borderRadius: 12,
    backgroundColor: "#171A1F",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },

  primaryButtonDisabled: {
    opacity: 0.6,
  },

  primaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  billingNote: {
    fontSize: 12,
    lineHeight: 18,
    color: "#7A828D",
    textAlign: "center",
    marginTop: 12,
  },

  managedCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 22,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#D9DDE3",
  },

  managedEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    color: "#68707C",
  },

  managedTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#252A31",
    marginTop: 8,
  },

  managedDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: "#68707C",
    marginTop: 7,
  },

  managedLink: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4F6338",
    marginTop: 14,
  },

  logoutButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    marginBottom: 8,
  },

  logoutButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#68707C",
  },
});