import React from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function FullyManagedScreen() {
  function handleRequestInformation() {
    Alert.alert(
      "Fully Managed Compliance",
      "Pricing and enrollment for fully managed compliance are coming soon."
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.card}>
          <Text style={styles.eyebrow}>WE HEART PAPERWORK</Text>

          <Text style={styles.title}>Fully Managed Compliance</Text>

          <Text style={styles.intro}>
            Hand off the paperwork, deadlines, and ongoing compliance
            monitoring so you can focus on keeping your trucks working.
          </Text>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>What fully managed means</Text>

          <Text style={styles.body}>
            Instead of managing every requirement yourself, our team helps
            monitor your company and driver compliance, identifies missing
            information, and works with you to keep records current.
          </Text>

          <View style={styles.feature}>
            <Text style={styles.featureTitle}>Company compliance monitoring</Text>
            <Text style={styles.featureText}>
              We help monitor recurring company requirements, renewal dates,
              registrations, and important compliance deadlines.
            </Text>
          </View>

          <View style={styles.feature}>
            <Text style={styles.featureTitle}>Driver file monitoring</Text>
            <Text style={styles.featureText}>
              We help review active-driver requirements and identify missing,
              expiring, or overdue records.
            </Text>
          </View>

          <View style={styles.feature}>
            <Text style={styles.featureTitle}>Personal follow-up</Text>
            <Text style={styles.featureText}>
              When something needs attention, you receive more than a reminder.
              Our team helps explain what is needed and follows up with you.
            </Text>
          </View>

          <View style={styles.feature}>
            <Text style={styles.featureTitle}>Your records remain available</Text>
            <Text style={styles.featureText}>
              Your dashboard remains the central place to view company and
              driver compliance information.
            </Text>
          </View>

          <View style={styles.pricingBox}>
            <Text style={styles.pricingTitle}>Pricing coming soon</Text>
            <Text style={styles.pricingText}>
              Fully managed pricing is being finalized. The dashboard
              subscription will remain available separately.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleRequestInformation}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>Request information</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.back()}
            activeOpacity={0.75}
          >
            <Text style={styles.secondaryButtonText}>
              Continue with dashboard plan
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F5F6F8",
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },

  backButton: {
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingRight: 16,
    marginBottom: 4,
  },

  backButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#5E6672",
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 30,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },

  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: "#68707C",
    marginBottom: 12,
  },

  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    color: "#171A1F",
    marginBottom: 14,
  },

  intro: {
    fontSize: 17,
    lineHeight: 25,
    color: "#4F5762",
  },

  divider: {
    height: 1,
    backgroundColor: "#E8EAED",
    marginVertical: 26,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#171A1F",
    marginBottom: 10,
  },

  body: {
    fontSize: 16,
    lineHeight: 24,
    color: "#5E6672",
    marginBottom: 24,
  },

  feature: {
    marginBottom: 20,
  },

  featureTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#252A31",
    marginBottom: 5,
  },

  featureText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#68707C",
  },

  pricingBox: {
    backgroundColor: "#F5F6F8",
    borderRadius: 14,
    padding: 18,
    marginTop: 4,
    marginBottom: 22,
  },

  pricingTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#252A31",
    marginBottom: 6,
  },

  pricingText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#68707C",
  },

  primaryButton: {
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: "#171A1F",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },

  primaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  secondaryButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },

  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#68707C",
    textAlign: "center",
  },
});