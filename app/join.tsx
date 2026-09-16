import Head from "expo-router/head";
import { Link, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import PublicFooter from "../components/public/PublicFooter";
import PublicHeader from "../components/public/PublicHeader";
import { normalizeReferralCode } from "../lib/referrals";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function ReferralJoinPage() {
  const params = useLocalSearchParams<{ ref?: string | string[] }>();
  const referralCode = normalizeReferralCode(firstParam(params.ref));
  const createAccountHref = referralCode
    ? ({ pathname: "/(auth)/login", params: { mode: "create", ref: referralCode } } as const)
    : ({ pathname: "/(auth)/login", params: { mode: "create" } } as const);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Head>
        <title>Company Referral | We Heart Paperwork</title>
        <meta name="description" content="Create a We Heart Paperwork account for your motor-carrier company through a customer referral." />
        <meta name="robots" content="noindex,follow" />
      </Head>
      <PublicHeader />
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>COMPANY REFERRAL</Text>
        <Text accessibilityRole="header" style={styles.title}>A trucking company invited your company.</Text>
        <Text style={styles.lead}>We Heart Paperwork helps motor-carrier companies organize driver, vehicle, and compliance deadlines in one place.</Text>

        <View style={styles.card}>
          {referralCode ? (
            <>
              <Text style={styles.status}>Referral code applied</Text>
              <Text selectable style={styles.code}>{referralCode}</Text>
              <Text style={styles.detail}>The code will stay attached while you create your company account. You will not need to enter it again.</Text>
            </>
          ) : (
            <>
              <Text style={styles.problem}>Referral code unavailable</Text>
              <Text style={styles.detail}>This link does not contain a valid referral code. You can still create a company account without one.</Text>
            </>
          )}

          <Link href={createAccountHref as any} asChild>
            <Pressable accessibilityRole="link" style={styles.primary}>
              <Text style={styles.primaryText}>Create your company account</Text>
            </Pressable>
          </Link>
          <Text style={styles.fine}>Business accounts only. We Heart Paperwork is for motor-carrier companies and organizations, including owner-operated businesses. It is not for personal, household, or family use.</Text>
        </View>

        <Text style={styles.disclosure}>The company that shared this link may receive a referral reward if your company signs up and makes qualifying payments. Referral rewards do not change your company’s price.</Text>
      </View>
      <PublicFooter />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#FAFAF8" },
  content: { minHeight: "100%" },
  hero: { width: "100%", maxWidth: 760, alignSelf: "center", paddingHorizontal: 24, paddingTop: 72, paddingBottom: 84 },
  eyebrow: { color: "#3B6D11", fontSize: 12, fontWeight: "800", letterSpacing: 1.2, textAlign: "center" },
  title: { marginTop: 14, color: "#1A1915", fontSize: 44, lineHeight: 51, fontWeight: "800", letterSpacing: -1.5, textAlign: "center" },
  lead: { maxWidth: 620, alignSelf: "center", marginTop: 18, color: "#5F5D57", fontSize: 18, lineHeight: 28, textAlign: "center" },
  card: { marginTop: 36, padding: 28, borderWidth: 1, borderColor: "#DAD7CC", borderRadius: 18, backgroundColor: "#FFFFFF", alignItems: "center" },
  status: { color: "#31551A", fontSize: 14, fontWeight: "800" },
  problem: { color: "#854F0B", fontSize: 14, fontWeight: "800" },
  code: { marginTop: 10, color: "#1A1915", fontSize: 27, fontWeight: "800", letterSpacing: 2 },
  detail: { maxWidth: 500, marginTop: 12, color: "#5F5D57", fontSize: 15, lineHeight: 23, textAlign: "center" },
  primary: { minHeight: 52, marginTop: 26, paddingHorizontal: 24, borderRadius: 11, backgroundColor: "#27500A", alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  fine: { maxWidth: 540, marginTop: 20, color: "#706E68", fontSize: 12, lineHeight: 19, textAlign: "center" },
  disclosure: { maxWidth: 620, alignSelf: "center", marginTop: 22, color: "#706E68", fontSize: 13, lineHeight: 20, textAlign: "center" },
});
