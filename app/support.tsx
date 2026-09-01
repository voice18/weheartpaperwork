import PublicHeader from "../components/public/PublicHeader";
import PublicFooter from "../components/public/PublicFooter";
import Head from "expo-router/head";
import { Link } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SupportPage() {
  return (
  <>
  <Head><title>Support | We Heart Paperwork</title><meta name="description" content="Get help with your We Heart Paperwork account, subscription, technical issue, or data request." /><link rel="canonical" href="https://weheartpaperwork.com/support" /><meta name="robots" content="index,follow" /></Head>
  <SafeAreaView
    edges={["top", "bottom"]}
    style={styles.page}
  >
    <PublicHeader />

    <ScrollView
      contentContainerStyle={styles.content}
    >

      <View style={styles.article}>
        <Text style={styles.eyebrow}>
          CUSTOMER SUPPORT
        </Text>

        <Text accessibilityRole="header" style={styles.title}>
          How can we help?
        </Text>

        <Text style={styles.paragraph}>
          For account access, subscription questions,
          technical issues, or feedback, contact us at
          aaron@weheartpaperwork.com.
        </Text>

        <Link href={"mailto:aaron@weheartpaperwork.com?subject=We%20Heart%20Paperwork%20Support" as any} asChild><Pressable accessibilityRole="link" style={styles.button}><Text style={styles.buttonText}>Email support</Text></Pressable></Link>

        <Text style={styles.sectionTitle}>
          Include these details
        </Text>

        <View style={styles.list}>
          <Text style={styles.listItem}>
            • Your company name
          </Text>
          <Text style={styles.listItem}>
            • The email address used for your account
          </Text>
          <Text style={styles.listItem}>
            • A short description of what happened
          </Text>
          <Text style={styles.listItem}>
            • A screenshot, when helpful
          </Text>
        </View>

        <Text style={styles.sectionTitle}>
          Account and data requests
        </Text>

        <Text style={styles.paragraph}>
          To request account deletion, data access, or
          correction, email aaron@weheartpaperwork.com with
          the subject “Account or Data Request.”
        </Text>

        <Text style={styles.sectionTitle}>
          Important note
        </Text>

        <Text style={styles.paragraph}>
          We Heart Paperwork helps organize compliance
          information and deadlines. It does not provide
          legal advice or guarantee regulatory compliance.
        </Text>

        <View style={styles.nextSteps}>
          <Text style={styles.sectionTitle}>Looking for compliance instructions?</Text>
          <Text style={styles.paragraph}>Support handles the product and your account. For filing steps, official destinations, and free document tools, start with the How-To library.</Text>
          <Link href={"/how-to" as any} asChild><Pressable style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Open How-To walkthroughs</Text></Pressable></Link>
        </View>
      </View>
      <PublicFooter />
    </ScrollView>
    </SafeAreaView>
    </>
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

  paragraph: {
    color: "#5F5D57",
    fontSize: 16,
    lineHeight: 27,
  },

  button: {
    alignSelf: "flex-start",
    minHeight: 48,
    marginTop: 26,
    paddingHorizontal: 20,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#27500A",
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  sectionTitle: {
    marginTop: 40,
    marginBottom: 12,
    color: "#1A1915",
    fontSize: 24,
    fontWeight: "800",
  },
  nextSteps: { marginTop: 12, paddingBottom: 40 },
  secondaryButton: { alignSelf:"flex-start",minHeight:48,marginTop:20,paddingHorizontal:20,borderWidth:1,borderColor:"#B6CBA4",borderRadius:11,alignItems:"center",justifyContent:"center",backgroundColor:"#FFFFFF" },
  secondaryButtonText: { color:"#27500A",fontSize:14,fontWeight:"700" },

  list: {
    gap: 10,
  },

  listItem: {
    color: "#5F5D57",
    fontSize: 16,
    lineHeight: 25,
  },
});
