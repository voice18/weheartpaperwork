import PublicHeader from "../components/public/PublicHeader";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PrivacyPage() {
  return (
    <SafeAreaView
  edges={["top", "bottom"]}
  style={styles.page}
>
  <PublicHeader />

    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
    >

      <View style={styles.article}>
        <Text style={styles.eyebrow}>
          LAST UPDATED AUGUST 4, 2026
        </Text>

        <Text style={styles.title}>Privacy Policy</Text>

        <Text style={styles.paragraph}>
          We Heart Paperwork provides software that helps
          trucking companies organize compliance deadlines,
          company records, driver information, and completion
          history.
        </Text>

        <Section
          title="Information we collect"
          text="Depending on how you use the service, we may collect account information, company information, USDOT information, driver records, compliance dates, completion history, files you choose to upload, billing status, device information, and app usage or diagnostic data."
        />

        <Section
          title="How we use information"
          text="We use information to provide and maintain the service, authenticate users, track deadlines, send requested notifications, process and verify subscription status, provide customer support, improve the product, and protect the service from misuse."
        />

        <Section
          title="Service providers"
          text="We may use third-party service providers for hosting, authentication, databases, notifications, payment processing, analytics, and customer support. These providers process information only as necessary to perform services for us."
        />

        <Section
          title="Billing"
          text="Payment information is processed by our payment provider. We do not directly store complete payment-card numbers."
        />

        <Section
          title="Data retention and deletion"
          text="We retain information for as long as needed to provide the service, meet legitimate business and legal requirements, resolve disputes, and maintain records requested by the account owner."
        />

        <Section
          title="Security"
          text="We use reasonable administrative and technical safeguards designed to protect information. No online system can guarantee absolute security."
        />

        <Section
          title="Children"
          text="We Heart Paperwork is intended for businesses and is not directed to children under 13."
        />

        <Section
          title="Changes to this policy"
          text="We may update this policy as the service changes. The current version will be posted on this page with its effective date."
        />

        <Text style={styles.sectionTitle}>Contact</Text>

        <Text style={styles.paragraph}>
          Questions or privacy requests may be sent to
          aaron@weheartpaperwork.com.
        </Text>
      </View>
    </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.paragraph}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#FAFAF8",
  },

  content: {
    minHeight: "100%",
    paddingBottom: 80,
  },

  header: {
    width: "100%",
    maxWidth: 960,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 12,
  },

  backLink: {
    color: "#27500A",
    fontSize: 14,
    fontWeight: "700",
  },

  article: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 72,
  },

  eyebrow: {
    marginBottom: 14,
    color: "#3B6D11",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.1,
  },

  title: {
    marginBottom: 26,
    color: "#1A1915",
    fontSize: 54,
    lineHeight: 58,
    fontWeight: "800",
    letterSpacing: -2.2,
  },

  section: {
    marginTop: 36,
  },

  sectionTitle: {
    marginTop: 36,
    marginBottom: 10,
    color: "#1A1915",
    fontSize: 24,
    fontWeight: "800",
  },

  paragraph: {
    color: "#5F5D57",
    fontSize: 16,
    lineHeight: 27,
  },
});
