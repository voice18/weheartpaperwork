import {
  useEffect,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  auth,
  functions,
} from "../lib/firebase";

export default function AccountScreen() {
  const [authResolved, setAuthResolved] =
  useState(false);

const [currentUser, setCurrentUser] =
  useState(auth.currentUser);

useEffect(() => {
  const unsubscribe =
    onAuthStateChanged(
      auth,
      (user) => {
        setCurrentUser(user);
        setAuthResolved(true);

        if (!user) {
          router.replace(
            "/(auth)/login"
          );
        }
      }
    );

  return unsubscribe;
}, []);
  const [deletingAccount, setDeletingAccount] =
    useState(false);

  const email =
    currentUser?.email ?? "Not available";

  const handleChangePassword = () => {
    const currentEmail =
      currentUser?.email;

    if (!currentEmail) {
      Alert.alert(
        "Email unavailable",
        "We could not find an email address for this account."
      );
      return;
    }

    Alert.alert(
      "Change password",
      `We will send a password-reset link to ${currentEmail}.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Send email",
          onPress: async () => {
            try {
              await sendPasswordResetEmail(
                auth,
                currentEmail
              );

              Alert.alert(
                "Email sent",
                "Check your inbox for a link to change your password."
              );
            } catch (error) {
              console.log(
                "Password reset failed:",
                error
              );

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

  const performDeleteAccount = async () => {
    if (deletingAccount) {
      return;
    }

    try {
      setDeletingAccount(true);

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
        // Backend may already have removed auth user.
      }

      router.replace("/(auth)/login");
    } catch (error: any) {
      console.error(
        "Account deletion failed:",
        error
      );

      Alert.alert(
        "Unable to delete account",
        typeof error?.details === "string"
          ? error.details
          : "Your account could not be deleted. Please try again."
      );
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleDeleteAccount = () => {
    if (deletingAccount) {
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
                  onPress:
                    performDeleteAccount,
                },
              ]
            );
          },
        },
      ]
    );
  };

if (!authResolved || !currentUser) {
  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F7F6F3",
      }}
    >
      <ActivityIndicator />
    </SafeAreaView>
  );
}

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={{
        flex: 1,
        backgroundColor: "#F7F6F3",
      }}
    >
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 20,
          paddingBottom: 48,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 680,
            alignSelf: "center",
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              alignSelf: "flex-start",
              paddingVertical: 6,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: "#27500A",
              }}
            >
              ‹ Compliance Guide
            </Text>
          </TouchableOpacity>

          <Text
            style={{
              marginTop: 12,
              fontSize: 30,
              lineHeight: 36,
              fontWeight: "800",
              color: "#1A1915",
            }}
          >
            Account & Support
          </Text>

          <Text
            style={{
              marginTop: 8,
              fontSize: 14,
              lineHeight: 21,
              color: "#706E68",
            }}
          >
            Manage your account or get help.
          </Text>

          <Text
            style={{
              marginTop: 28,
              marginBottom: 8,
              marginLeft: 4,
              fontSize: 11,
              fontWeight: "800",
              letterSpacing: 0.8,
              color: "#706E68",
              textTransform: "uppercase",
            }}
          >
            Account
          </Text>

          <View
            style={{
              overflow: "hidden",
              borderWidth: 1,
              borderColor: "#E5E3DA",
              borderRadius: 14,
              backgroundColor: "#FFFFFF",
            }}
          >
            <AccountRow
              label="Login email"
              value={email}
            />

            <AccountRow
              label="Change password"
              onPress={
                handleChangePassword
              }
            />

            <AccountRow
              label="Log out"
              destructive
              showDivider={false}
              onPress={handleLogOut}
            />
          </View>

          <Text
            style={{
              marginTop: 28,
              marginBottom: 8,
              marginLeft: 4,
              fontSize: 11,
              fontWeight: "800",
              letterSpacing: 0.8,
              color: "#706E68",
              textTransform: "uppercase",
            }}
          >
            Help
          </Text>

          <View
            style={{
              overflow: "hidden",
              borderWidth: 1,
              borderColor: "#E5E3DA",
              borderRadius: 14,
              backgroundColor: "#FFFFFF",
            }}
          >
            <AccountRow
              label="Support"
              onPress={() =>
                router.push("/support")
              }
            />

            <AccountRow
              label="Privacy Policy"
              showDivider={false}
              onPress={() =>
                router.push("/privacy")
              }
            />
          </View>

          <Text
            style={{
              marginTop: 28,
              marginBottom: 8,
              marginLeft: 4,
              fontSize: 11,
              fontWeight: "800",
              letterSpacing: 0.8,
              color: "#706E68",
              textTransform: "uppercase",
            }}
          >
            Account management
          </Text>

          <View
            style={{
              overflow: "hidden",
              borderWidth: 1,
              borderColor: "#E5E3DA",
              borderRadius: 14,
              backgroundColor: "#FFFFFF",
            }}
          >
            <AccountRow
              label={
                deletingAccount
                  ? "Deleting..."
                  : "Delete account"
              }
              destructive
              showDivider={false}
              onPress={
                deletingAccount
                  ? undefined
                  : handleDeleteAccount
              }
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function AccountRow({
  label,
  value,
  onPress,
  destructive = false,
  showDivider = true,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  showDivider?: boolean;
}) {
  return (
    <TouchableOpacity
      disabled={!onPress}
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        minHeight: 56,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottomWidth:
          showDivider ? 1 : 0,
        borderBottomColor: "#EEECE5",
      }}
    >
      <Text
        style={{
          flex: 1,
          fontSize: 15,
          fontWeight: "600",
          color: destructive
            ? "#A32D2D"
            : "#25241F",
        }}
      >
        {label}
      </Text>

      {value ? (
        <Text
          numberOfLines={1}
          style={{
            maxWidth: "55%",
            marginLeft: 12,
            fontSize: 13,
            color: "#706E68",
          }}
        >
          {value}
        </Text>
      ) : onPress ? (
        <Text
          style={{
            marginLeft: 12,
            fontSize: 18,
            color: "#9A9890",
          }}
        >
          ›
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}