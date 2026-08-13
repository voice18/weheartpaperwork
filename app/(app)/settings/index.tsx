
import { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  Modal,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { router } from "expo-router";
import {
  sendPasswordResetEmail,
  signOut,
  verifyBeforeUpdateEmail,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  onSnapshot,
} from "firebase/firestore";
import { auth, db, functions, } from "../../../lib/firebase";
import { registerForPushNotifications } from "../../../lib/registerPushNotifications";
import SettingsRow from "../../../components/settings/SettingsRow";
import { useComplianceStore } from "../../../store/useComplianceStore";
import Constants from "expo-constants";
import type {
  CarrierBilling,
} from "../../../lib/billing";
import * as Linking from "expo-linking";
import { httpsCallable } from "firebase/functions";

export default function SettingsScreen() {
    const appVersion =
  Constants.expoConfig?.version ?? "1.0.0";
  const [notificationsEnabled, setNotificationsEnabled] =
    useState(true);

  const [billing, setBilling] =
  useState<CarrierBilling | null>(null);

  const [billingLoaded, setBillingLoaded] =
  useState(false);

  const [activeDriverCount, setActiveDriverCount] =
  useState(0);

  const [deletingAccount, setDeletingAccount] =
  useState(false);

  useEffect(() => {
  const userId = auth.currentUser?.uid;

  if (!userId) {
    setBilling(null);
    setBillingLoaded(true);
    setActiveDriverCount(0);
    return;
  }

  const carrierRef = doc(
    db,
    "carriers",
    userId
  );

  const driversRef = collection(
  db,
  "carriers",
  userId,
  "drivers"
);

  const unsubscribeCarrier = onSnapshot(
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
        "Unable to load billing information:",
        error
      );

      setBilling(null);
      setBillingLoaded(true);
    }
  );

  const unsubscribeDrivers = onSnapshot(
     driversRef,
    (snapshot) => {
          const activeCount = snapshot.docs.filter(
      (driverDoc) =>
        driverDoc.data().status !== "inactive"
    ).length;

    setActiveDriverCount(activeCount);
    },
    (error) => {
      console.error(
        "Unable to count active drivers:",
        error
      );

      setActiveDriverCount(0);
    }
  );

  return () => {
    unsubscribeCarrier();
    unsubscribeDrivers();
  };
}, []);


const [openingBillingPortal, setOpeningBillingPortal] =
  useState(false);

const [companyName, setCompanyName] = useState("");
const setUsdotInStore = useComplianceStore((state) => state.setUsdot);

const [usdotModalOpen, setUsdotModalOpen] = useState(false);
const [usdotDraft, setUsdotDraft] = useState("");
const [savingUsdot, setSavingUsdot] = useState(false);

const [usdotNumber, setUsdotNumber] = useState("");
const [phoneNumber, setPhoneNumber] = useState("");

const [loadingCompany, setLoadingCompany] = useState(true);

const [phoneModalOpen, setPhoneModalOpen] = useState(false);
const [phoneDraft, setPhoneDraft] = useState("");
const [savingPhone, setSavingPhone] = useState(false);

const [emailModalOpen, setEmailModalOpen] = useState(false);
const [emailDraft, setEmailDraft] = useState("");
const [savingEmail, setSavingEmail] = useState(false);

const [savingNotifications, setSavingNotifications] = useState(false);

const [companyNameModalOpen, setCompanyNameModalOpen] =
  useState(false);

const [companyNameDraft, setCompanyNameDraft] =
  useState("");

const [savingCompanyName, setSavingCompanyName] =
  useState(false);

useEffect(() => {
  const loadCompanySettings = async () => {
    const user = auth.currentUser;

    if (!user) {
      setLoadingCompany(false);
      return;
    }

    try {
      const carrierSnap = await getDoc(
        doc(db, "carriers", user.uid)
      );

      if (carrierSnap.exists()) {
        const data = carrierSnap.data();

        setCompanyName(
          typeof data.companyName === "string"
            ? data.companyName
            : ""
        );

        setUsdotNumber(
          typeof data.usdotNumber === "string"
            ? data.usdotNumber
            : ""
        );

        setPhoneNumber(
          typeof data.phoneNumber === "string"
            ? data.phoneNumber
            : ""
        );


      }

            const userSnap = await getDoc(
        doc(db, "users", user.uid)
        );

        if (userSnap.exists()) {
        const userData = userSnap.data();

        setNotificationsEnabled(
            userData.notificationsEnabled === true
        );
        }

    } catch (error) {
      console.log("Unable to load company settings:", error);

      Alert.alert(
        "Unable to load company information",
        "Please try again."
      );
    } finally {
      setLoadingCompany(false);
    }
  };

  loadCompanySettings();
}, []);



const openCompanyNameEditor = () => {
  setCompanyNameDraft(companyName);
  setCompanyNameModalOpen(true);
};

const saveCompanyName = async () => {
  const user = auth.currentUser;
  const cleanedName = companyNameDraft.trim();

  if (!user) {
    Alert.alert("Not signed in", "Please log in again.");
    return;
  }

  if (!cleanedName) {
    Alert.alert(
      "Company name required",
      "Enter your company name before saving."
    );
    return;
  }

  try {
    setSavingCompanyName(true);

    await setDoc(
      doc(db, "carriers", user.uid),
      {
        companyName: cleanedName,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    setCompanyName(cleanedName);
    setCompanyNameModalOpen(false);
  } catch (error) {
    console.log("Company name save failed:", error);

    Alert.alert(
      "Unable to save",
      "Your company name could not be updated."
    );
  } finally {
    setSavingCompanyName(false);
  }
};


const openUsdotEditor = () => {
  setUsdotDraft(usdotNumber);
  setUsdotModalOpen(true);
};

const saveUsdotNumber = async () => {
  const user = auth.currentUser;
  const cleanedNumber = usdotDraft.replace(/\D/g, "");

  if (!user) {
    Alert.alert("Not signed in", "Please log in again.");
    return;
  }

  if (!cleanedNumber) {
    Alert.alert(
      "USDOT number required",
      "Enter your USDOT number before saving."
    );
    return;
  }

  try {
    setSavingUsdot(true);


    await setUsdotInStore(cleanedNumber);

    setUsdotNumber(cleanedNumber);
    setUsdotModalOpen(false);
  } catch (error) {
    console.log("USDOT save failed:", error);

    Alert.alert(
      "Unable to save",
      "Your USDOT number could not be updated."
    );
  } finally {
    setSavingUsdot(false);
  }
};

const openPhoneEditor = () => {
  setPhoneDraft(phoneNumber);
  setPhoneModalOpen(true);
};

const savePhoneNumber = async () => {
  const user = auth.currentUser;
  const cleanedPhone = phoneDraft.trim();

  if (!user) {
    Alert.alert("Not signed in", "Please log in again.");
    return;
  }

  if (!cleanedPhone) {
    Alert.alert(
      "Phone number required",
      "Enter a company phone number before saving."
    );
    return;
  }

  try {
    setSavingPhone(true);

    await setDoc(
      doc(db, "carriers", user.uid),
      {
        phoneNumber: cleanedPhone,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    setPhoneNumber(cleanedPhone);
    setPhoneModalOpen(false);
  } catch (error) {
    console.log("Phone number save failed:", error);

    Alert.alert(
      "Unable to save",
      "Your phone number could not be updated."
    );
  } finally {
    setSavingPhone(false);
  }
};

const openEmailEditor = () => {
  setEmailDraft(auth.currentUser?.email ?? "");
  setEmailModalOpen(true);
};

const saveLoginEmail = async () => {
  const user = auth.currentUser;
  const cleanedEmail = emailDraft.trim().toLowerCase();

  if (!user) {
    Alert.alert("Not signed in", "Please log in again.");
    return;
  }

  if (!cleanedEmail || !cleanedEmail.includes("@")) {
    Alert.alert(
      "Valid email required",
      "Enter a valid email address before saving."
    );
    return;
  }

  if (cleanedEmail === user.email?.toLowerCase()) {
    setEmailModalOpen(false);
    return;
  }

  try {
    setSavingEmail(true);

    await verifyBeforeUpdateEmail(user, cleanedEmail);

    setEmailModalOpen(false);

    Alert.alert(
      "Verification email sent",
      `Open the message sent to ${cleanedEmail} and verify the address. Your login email will change after verification.`
    );
  } catch (error: any) {
    console.log("Email update failed:", error);

    if (error?.code === "auth/requires-recent-login") {
      Alert.alert(
        "Please sign in again",
        "For security, log out and sign back in before changing your email."
      );
      return;
    }

    if (error?.code === "auth/email-already-in-use") {
      Alert.alert(
        "Email already in use",
        "That email address belongs to another account."
      );
      return;
    }

    if (error?.code === "auth/invalid-email") {
      Alert.alert(
        "Invalid email",
        "Enter a valid email address."
      );
      return;
    }

    Alert.alert(
      "Unable to change email",
      "Please check the address and try again."
    );
  } finally {
    setSavingEmail(false);
  }
};

const updateNotificationStatus = async (
  enabled: boolean
) => {
  const user = auth.currentUser;

  if (!user || savingNotifications) {
    return;
  }

  const previousValue = notificationsEnabled;

  try {
    setSavingNotifications(true);

    // Turning notifications off does not remove the token.
    // Keeping it allows the user to turn notifications back on easily.
    if (!enabled) {
      await setDoc(
        doc(db, "users", user.uid),
        {
          notificationsEnabled: false,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setNotificationsEnabled(false);
      return;
    }

    // Turning notifications on must register this specific device.
    const registration =
      await registerForPushNotifications();

    if (!registration.success) {
      setNotificationsEnabled(false);

      Alert.alert(
        registration.reason === "web"
          ? "Use the mobile app"
          : "Notifications not enabled",
        registration.message
      );

      return;
    }

    await setDoc(
      doc(db, "users", user.uid),
      {
        notificationsEnabled: true,
        expoPushToken: registration.expoPushToken,
        notificationTokenUpdatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // Keep the carrier copy synchronized for now because onboarding
    // currently writes notification fields there too.
    await setDoc(
      doc(db, "carriers", user.uid),
      {
        notificationsEnabled: true,
        expoPushToken: registration.expoPushToken,
        notificationTokenUpdatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    setNotificationsEnabled(true);

    Alert.alert(
      "Notifications enabled",
      "This device is now registered to receive paperwork reminders."
    );
  } catch (error) {
    console.log(
      "Notification registration failed:",
      error
    );

    setNotificationsEnabled(previousValue);

    Alert.alert(
      "Unable to enable notifications",
      "Please check your connection and try again."
    );
  } finally {
    setSavingNotifications(false);
  }
};


const handleChangePassword = () => {
  const email = auth.currentUser?.email;

  if (!email) {
    Alert.alert(
      "Email unavailable",
      "We could not find an email address for this account."
    );
    return;
  }

  Alert.alert(
    "Change password",
    `We will send a password-reset link to ${email}.`,
    [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Send email",
        onPress: async () => {
          try {
            await sendPasswordResetEmail(auth, email);

            Alert.alert(
              "Email sent",
              "Check your inbox for a link to change your password."
            );
          } catch (error) {
            console.log("Password reset failed:", error);

            Alert.alert(
              "Unable to send email",
              "Please check your connection and try again."
            );
          }
        },
      },
    ]
  );
};

  const handleLogOut = async () => {
    try {
      await signOut(auth);
      router.replace("/(auth)/login");
    } catch (error) {
      console.log("Logout error:", error);

      Alert.alert(
        "Unable to log out",
        "Please try again."
      );
    }
  };

  async function handleManageBilling() {
  if (openingBillingPortal) {
    return;
  }

  try {
    setOpeningBillingPortal(true);

    const createBillingPortalSession = httpsCallable<
      Record<string, never>,
      { url: string }
    >(
      functions,
      "createBillingPortalSession"
    );

    const result =
      await createBillingPortalSession({});

    const portalUrl = result.data?.url;

    if (!portalUrl) {
      throw new Error(
        "Stripe did not return a billing portal URL."
      );
    }

    await Linking.openURL(portalUrl);
  } catch (error: any) {
    console.error(
      "Unable to open billing portal:",
      error
    );

    const message =
      typeof error?.details === "string"
        ? error.details
        : typeof error?.message === "string"
          ? error.message
          : "Billing is not available right now.";

    Alert.alert(
      "Unable to open billing",
      message
    );
  } finally {
    setOpeningBillingPortal(false);
  }
}

const estimatedMonthlyAmountCents =
  200 + activeDriverCount * 100;

const estimatedMonthlyAmount =
  `$${(
    estimatedMonthlyAmountCents / 100
  ).toFixed(2)}`;

const billingStatus =
  billing?.status ?? null;

const billingStatusLabel = (() => {
  switch (billingStatus) {
    case "trialing":
      return "Free trial";
    case "active":
      return "Active";
    case "past_due":
      return "Payment past due";
    case "canceled":
      return "Canceled";
    case "unpaid":
      return "Unpaid";
    default:
      return billingLoaded
        ? "Setup required"
        : "Loading…";
  }
})();

const billingStatusColor = (() => {
  switch (billingStatus) {
    case "trialing":
    case "active":
      return "#587A3B";
    case "past_due":
      return "#854F0B";
    case "canceled":
    case "unpaid":
      return "#A33A32";
    default:
      return "#68707C";
  }
})();

const performDeleteAccount = async () => {
  if (deletingAccount) {
    return;
  }

  setDeletingAccount(true);

  try {
    const deleteAccount = httpsCallable<
      Record<string, never>,
      { success: boolean }
    >(
      functions,
      "deleteAccount"
    );

    await deleteAccount({});

    try {
      await signOut(auth);
    } catch {
      // The backend may already have deleted the
      // Firebase Auth user. Either way, return to login.
    }

    router.replace("/(auth)/login");
  } catch (error: any) {
    console.error(
      "Account deletion failed:",
      error
    );

    const message =
      typeof error?.details === "string"
        ? error.details
        : "Your account could not be deleted. Please try again.";

    Alert.alert(
      "Unable to delete account",
      message
    );
  } finally {
    setDeletingAccount(false);
  }
};

const handleDeleteAccount = () => {
  if (deletingAccount) {
    return;
  }

  if (
    Platform.OS === "web" &&
    typeof window !== "undefined"
  ) {
    const firstConfirmed = window.confirm(
      "Delete account?\n\n" +
      "This permanently deletes your company account, drivers, compliance records, and history. " +
      "Your subscription will also be canceled. This cannot be undone."
    );

    if (!firstConfirmed) {
      return;
    }

    const finalConfirmed = window.confirm(
      "Delete permanently?\n\n" +
      "This is your final confirmation. Your account and company data cannot be recovered after deletion."
    );

    if (!finalConfirmed) {
      return;
    }

    void performDeleteAccount();
    return;
  }

  Alert.alert(
    "Delete account?",
    "This permanently deletes your company account, drivers, compliance records, and history. Your subscription will also be canceled. This cannot be undone.",
    [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Continue",
        style: "destructive",
        onPress: () => {
          Alert.alert(
            "Delete permanently?",
            "This is your final confirmation. Your account and company data cannot be recovered after deletion.",
            [
              {
                text: "Cancel",
                style: "cancel",
              },
              {
                text: "Delete permanently",
                style: "destructive",
                onPress: performDeleteAccount,
              },
            ]
          );
        },
      },
    ]
  );
};

const cancellationDateLabel = (() => {
  const cancelAt = billing?.cancelAt;

  if (!cancelAt) {
    return null;
  }

  try {
    return cancelAt
      .toDate()
      .toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
  } catch (error) {
    console.error(
      "Unable to format cancellation date:",
      error
    );

    return null;
  }
})();
const trialEndLabel = (() => {
  const trialEndsAt = billing?.trialEndsAt;

  if (!trialEndsAt) {
    return null;
  }

  try {
    return trialEndsAt
      .toDate()
      .toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
  } catch (error) {
    console.error(
      "Unable to format trial end date:",
      error
    );

    return null;
  }
})();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        {Platform.OS === "web" && (
        <TouchableOpacity
          onPress={() =>
            router.replace("/(app)/dashboard")
          }
          style={{
            alignSelf: "flex-start",
            paddingVertical: 6,
            marginBottom: 10,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: "#27500A",
            }}
          >
            ‹ Dashboard
          </Text>
        </TouchableOpacity>
      )}
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>
            Manage your company, account, notifications, and subscription.
          </Text>
        </View>

        <Text style={styles.sectionLabel}>
          Company
        </Text>

        <View style={styles.card}>
                <SettingsRow
            label="Company name"
            value={
                loadingCompany
                ? "Loading..."
                : companyName || "Not entered"
            }
            onPress={openCompanyNameEditor}
            />

          <SettingsRow
            label="USDOT number"
                  value={
            loadingCompany
            ? "Loading..."
             : usdotNumber || "Not entered"
            }
            onPress={openUsdotEditor}
          />

                    <SettingsRow
            label="Phone number"
            value={
                loadingCompany
                ? "Loading..."
                : phoneNumber || "Not entered"
            }
            showDivider={false}
            onPress={openPhoneEditor}
            />
        </View>

        <Text style={styles.sectionLabel}>
          Account
        </Text>

        <View style={styles.card}>
          <SettingsRow
        label="Login email"
        value={auth.currentUser?.email ?? "Not available"}
        onPress={openEmailEditor}
      />

                <SettingsRow
            label="Change password"
            onPress={handleChangePassword}
            />

          <SettingsRow
            label="Log out"
            valueColor="#A32D2D"
            showDivider={false}
            onPress={handleLogOut}
          />
        </View>

        <Text style={styles.sectionLabel}>
          Notifications
        </Text>

        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={styles.rowTitle}>
                Push notifications
              </Text>

              <Text style={styles.rowDescription}>
                Receive alerts 30, 15, and 5 days before most compliance deadlines.
              </Text>
            </View>

            <Switch
            value={notificationsEnabled}
            onValueChange={updateNotificationStatus}
            disabled={savingNotifications}
              trackColor={{
                false: "#D3D1C7",
                true: "#7DA35A",
              }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>


        <Text style={styles.sectionLabel}>
        Subscription
      </Text>

      <View style={styles.card}>
        <SettingsRow
          label="Current plan"
          value="Dashboard subscription"
        />

        <SettingsRow
          label="Subscription status"
          value={billingStatusLabel}
          valueColor={billingStatusColor}
        />
        {cancellationDateLabel && (
        <SettingsRow
          label="Subscription ends"
          value={cancellationDateLabel}
          valueColor="#854F0B"
        />
      )}

            {billingStatus === "trialing" &&
          trialEndLabel &&
          !cancellationDateLabel && (
            <SettingsRow
              label="Trial ends"
              value={trialEndLabel}
            />
          )}

        <SettingsRow
          label="Active drivers"
          value={String(activeDriverCount)}
        />

        <SettingsRow
          label="Estimated monthly price"
          value={estimatedMonthlyAmount}
        />

        <SettingsRow
          label="Pricing"
          value={`$2 company + $1 x ${activeDriverCount}`}
          showDivider={Platform.OS === "web"}
        />

      {Platform.OS === "web" && (
        <SettingsRow
        label="Manage billing"
        value={
          openingBillingPortal
            ? "Opening..."
            : undefined
        }
        showDivider={false}
        onPress={
          openingBillingPortal
            ? undefined
            : handleManageBilling
        }
      />
      )}
      </View>

        <Text style={styles.sectionLabel}>
          Support
        </Text>

        <View style={styles.card}>
          <SettingsRow
            label="Support"
            onPress={() =>
              router.push("/support")
            }
          />

          <SettingsRow
            label="Privacy Policy"
            onPress={() =>
              router.push("/privacy")
            }
          />

          <SettingsRow
            label="App version"
            value={appVersion}
            showDivider={false}
          />
        </View>

        <Text style={styles.sectionLabel}>
  Account management
</Text>

        <View style={styles.card}>
          <SettingsRow
            label="Delete account"
            value={
              deletingAccount
                ? "Deleting..."
                : "Permanent"
            }
            valueColor="#A32D2D"
            showDivider={false}
            onPress={
              deletingAccount
                ? undefined
                : handleDeleteAccount
            }
          />
        </View>
      </ScrollView>
      <Modal
    visible={companyNameModalOpen}
    transparent
    animationType="fade"
    presentationStyle="overFullScreen"
    onRequestClose={() => {
    if (!savingCompanyName) {
      setCompanyNameModalOpen(false);
    }
  }}
>
  <View style={styles.modalBackdrop}>
    <View style={styles.modalCard}>
      <Text style={styles.modalTitle}>
        Company name
      </Text>

      <TextInput
        value={companyNameDraft}
        onChangeText={setCompanyNameDraft}
        placeholder="Enter company name"
        autoCapitalize="words"
        autoCorrect={false}
        editable={!savingCompanyName}
        style={styles.modalInput}
      />

      <View style={styles.modalActions}>
        <TouchableOpacity
          disabled={savingCompanyName}
          onPress={() =>
            setCompanyNameModalOpen(false)
          }
          style={styles.modalCancelButton}
        >
          <Text style={styles.modalCancelText}>
            Cancel
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          disabled={savingCompanyName}
          onPress={saveCompanyName}
          style={[
            styles.modalSaveButton,
            savingCompanyName && styles.disabledButton,
          ]}
        >
          <Text style={styles.modalSaveText}>
            {savingCompanyName ? "Saving..." : "Save"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>

<Modal
  visible={usdotModalOpen}
  transparent
  animationType="fade"
  presentationStyle="overFullScreen"
  onRequestClose={() => {
    if (!savingUsdot) {
      setUsdotModalOpen(false);
    }
  }}
>
  <View style={styles.modalBackdrop}>
    <View style={styles.modalCard}>
      <Text style={styles.modalTitle}>
        USDOT Number
      </Text>

      <TextInput
        value={usdotDraft}
        onChangeText={setUsdotDraft}
        placeholder="Enter USDOT Number"
        keyboardType="number-pad"
        editable={!savingUsdot}
        style={styles.modalInput}
      />

      <View style={styles.modalActions}>
        <TouchableOpacity
          disabled={savingUsdot}
          onPress={() => setUsdotModalOpen(false)}
          style={styles.modalCancelButton}
        >
          <Text style={styles.modalCancelText}>
            Cancel
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          disabled={savingUsdot}
          onPress={saveUsdotNumber}
          style={[
            styles.modalSaveButton,
            savingUsdot && styles.disabledButton,
          ]}
        >
          <Text style={styles.modalSaveText}>
            {savingUsdot ? "Saving..." : "Save"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>

<Modal
  visible={phoneModalOpen}
  transparent
  animationType="fade"
  presentationStyle="overFullScreen"
  onRequestClose={() => {
    if (!savingPhone) {
      setPhoneModalOpen(false);
    }
  }}
>
  <View style={styles.modalBackdrop}>
    <View style={styles.modalCard}>
      <Text style={styles.modalTitle}>
        Phone number
      </Text>

      <TextInput
        value={phoneDraft}
        onChangeText={setPhoneDraft}
        placeholder="Enter company phone number"
        keyboardType="phone-pad"
        autoCorrect={false}
        editable={!savingPhone}
        style={styles.modalInput}
      />

      <View style={styles.modalActions}>
        <TouchableOpacity
          disabled={savingPhone}
          onPress={() => setPhoneModalOpen(false)}
          style={styles.modalCancelButton}
        >
          <Text style={styles.modalCancelText}>
            Cancel
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          disabled={savingPhone}
          onPress={savePhoneNumber}
          style={[
            styles.modalSaveButton,
            savingPhone && styles.disabledButton,
          ]}
        >
          <Text style={styles.modalSaveText}>
            {savingPhone ? "Saving..." : "Save"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>

<Modal
  visible={emailModalOpen}
  transparent
  animationType="fade"
  presentationStyle="overFullScreen"
  onRequestClose={() => {
    if (!savingEmail) {
      setEmailModalOpen(false);
    }
  }}
>
  <View style={styles.modalBackdrop}>
    <View style={styles.modalCard}>
      <Text style={styles.modalTitle}>
        Change login email
      </Text>

      <Text style={styles.modalDescription}>
        We'll send a verification link to the new address.
      </Text>

      <TextInput
        value={emailDraft}
        onChangeText={setEmailDraft}
        placeholder="Enter new email address"
        placeholderTextColor="#9A9890"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!savingEmail}
        style={styles.modalInput}
      />

      <View style={styles.modalActions}>
        <TouchableOpacity
          disabled={savingEmail}
          onPress={() => setEmailModalOpen(false)}
          style={styles.modalCancelButton}
        >
          <Text style={styles.modalCancelText}>
            Cancel
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          disabled={savingEmail}
          onPress={saveLoginEmail}
          style={[
            styles.modalSaveButton,
            savingEmail && styles.disabledButton,
          ]}
        >
          <Text style={styles.modalSaveText}>
            {savingEmail ? "Sending..." : "Send verification"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F6F5F0",
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 48,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#25241F",
  },
  subtitle: {
    marginTop: 6,
    maxWidth: 480,
    fontSize: 14,
    lineHeight: 20,
    color: "#706E68",
  },
  sectionLabel: {
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: "#706E68",
  },
  card: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E3DA",
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
  },
  switchRow: {
    minHeight: 76,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  switchText: {
    flex: 1,
    paddingRight: 12,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#25241F",
  },
  rowDescription: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: "#706E68",
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },

  modalCard: {
    width: "100%",
    maxWidth: 420,
    padding: 20,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E3DA",
  },

  modalTitle: {
    marginBottom: 14,
    fontSize: 20,
    fontWeight: "700",
    color: "#25241F",
  },

  modalInput: {
    minHeight: 48,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#D3D1C7",
    borderRadius: 8,
    fontSize: 16,
    color: "#25241F",
    backgroundColor: "#FFFFFF",
  },

  modalActions: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "flex-end",
  },

  modalCancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },

  modalCancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#706E68",
  },

  modalSaveButton: {
    marginLeft: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#27500A",
  },

  modalSaveText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  disabledButton: {
    opacity: 0.6,
  },

  modalDescription: {
  marginTop: -6,
  marginBottom: 14,
  fontSize: 13,
  lineHeight: 18,
  color: "#706E68",
},

});