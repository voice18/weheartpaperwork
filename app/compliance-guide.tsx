import { useEffect, useState } from "react";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  Platform,
  View,
} from "react-native";
import { onAuthStateChanged } from "firebase/auth";
import { router } from "expo-router";
import { auth } from "../lib/firebase";
import {
  SafeAreaView,
} from "react-native-safe-area-context";

import GuideDetail from "../components/guide/GuideDetail";
import GuideTile from "../components/guide/GuideTile";

import {
  COMPLIANCE_GUIDE_DISCLAIMER,
  companyGuideEntries,
  driverGuideEntries,
  type ComplianceGuideEntry,
} from "../lib/complianceGuide";

export default function ComplianceGuideScreen() {
  const [
    selectedEntry,
    setSelectedEntry,
  ] = useState<ComplianceGuideEntry | null>(null);


  const [isSignedIn, setIsSignedIn] =
  useState(Boolean(auth.currentUser));

useEffect(() => {
  const unsubscribe = onAuthStateChanged(
    auth,
    user => {
      setIsSignedIn(Boolean(user));
    }
  );

  return unsubscribe;
}, []);

function handleAccountAction() {
  if (isSignedIn) {
    router.push("/account");
    return;
  }

  router.replace("/(auth)/login");
}

function handleCreateAccount() {
  router.push({ pathname: "/(auth)/login", params: { mode: "create" } });
}

  if (selectedEntry) {
    return (
      <SafeAreaView
        edges={["top", "bottom"]}
        style={{
          flex: 1,
          backgroundColor: "#F7F6F3",
        }}
      >
        <GuideDetail
          entry={selectedEntry}
          onBack={() => setSelectedEntry(null)}
        />
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
            maxWidth: 680,
            width: "100%",
            alignSelf: "center",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "800",
                letterSpacing: 1.1,
                color: "#27500A",
                textTransform: "uppercase",
              }}
            >
              We Heart Paperwork
            </Text>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              {Platform.OS === "web" && isSignedIn && (
                <TouchableOpacity
                  onPress={() =>
                    router.replace("/(app)/dashboard")
                  }
                  activeOpacity={0.75}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: "#27500A",
                    }}
                  >
                    Dashboard
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={handleAccountAction}
                activeOpacity={0.75}
                style={{
                  paddingVertical: 6,
                  paddingLeft: 10,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: "#27500A",
                  }}
                >
                  {isSignedIn ? "Account" : "Sign in"}
                </Text>
              </TouchableOpacity>
              {!isSignedIn ? (
                <TouchableOpacity
                  onPress={handleCreateAccount}
                  activeOpacity={0.75}
                  style={{
                    marginLeft: 6,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 8,
                    backgroundColor: "#27500A",
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#FFFFFF" }}>
                    Create account
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <Text
            style={{
              marginTop: 7,
              fontSize: 30,
              lineHeight: 36,
              fontWeight: "800",
              color: "#1A1915",
            }}
          >
            Compliance Guide
          </Text>

          <Text
            style={{
              marginTop: 9,
              fontSize: 15,
              lineHeight: 22,
              color: "#706E68",
              maxWidth: 520,
            }}
          >
            Understand what we track, what information
            to enter, how deadlines are calculated, and
            what happens when you mark an item complete.
          </Text>

          <View
            style={{
              marginTop: 26,
              marginBottom: 10,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "800",
                letterSpacing: 0.8,
                color: "#706E68",
                textTransform: "uppercase",
              }}
            >
              Company compliance
            </Text>
          </View>

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "space-between",
            }}
          >
            {companyGuideEntries.map((entry) => (
              <GuideTile
                key={entry.id}
                entry={entry}
                onPress={() =>
                  setSelectedEntry(entry)
                }
              />
            ))}
          </View>

          <View
            style={{
              marginTop: 18,
              marginBottom: 10,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "800",
                letterSpacing: 0.8,
                color: "#706E68",
                textTransform: "uppercase",
              }}
            >
              Driver compliance
            </Text>
          </View>

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "space-between",
            }}
          >
            {driverGuideEntries.map((entry) => (
              <GuideTile
                key={entry.id}
                entry={entry}
                onPress={() =>
                  setSelectedEntry(entry)
                }
              />
            ))}
          </View>

          <View
            style={{
              marginTop: 22,
              paddingTop: 16,
              borderTopWidth: 1,
              borderTopColor: "#E2E0D8",
            }}
          >
            <Text
              style={{
                fontSize: 11,
                lineHeight: 17,
                color: "#8A8880",
              }}
            >
              {COMPLIANCE_GUIDE_DISCLAIMER}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
