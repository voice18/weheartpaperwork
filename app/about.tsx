import { Link } from "expo-router";
import Head from "expo-router/head";
import type { ReactNode } from "react";
import PublicHeader from "../components/public/PublicHeader";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { usePublicCompact } from "../hooks/usePublicCompact";

export default function AboutPage() {
  const compact = usePublicCompact();

  return (
    <>
      <Head>
        <title>About We Heart Paperwork | Built by a Trucking Company Owner</title>
        <meta
          name="description"
          content="The real story behind We Heart Paperwork: built by a Yakima trucking company owner who needed a simpler way to stay ahead of compliance deadlines."
        />
        <link rel="canonical" href="https://weheartpaperwork.com/about" />
      </Head>

      <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
        <PublicHeader />

        <View style={[styles.hero, compact && styles.heroCompact]}>
          <Text style={styles.eyebrow}>ABOUT ME · AUGUST 2026</Text>
          <Text style={[styles.heroTitle, compact && styles.heroTitleCompact]}>I sold my last truck last week.</Text>
          <Text style={styles.heroDescription}>Four years of vocational work out of Yakima, but rarely nearby. If you&apos;ve run vocational, you know what winter does to it—the cold, the breakdowns that only happen at 5 a.m. in January, the season drying up while the payments don&apos;t. I did enough of those winters to know I wasn&apos;t doing another one.</Text>
          <Text style={styles.heroDescription}>What I didn&apos;t want was to leave the industry. I just didn&apos;t want to keep doing it from the driver&apos;s seat.</Text>
        </View>

        <StorySection compact={compact} eyebrow="THE THING I BUILT WHILE I WAS STILL IN IT" title="Somewhere in those four years I stopped being able to keep the paperwork straight in my head.">
          <Text style={styles.bodyText}>You already know the job. You drive. You do the billing. You chase the next contract. You deal with the truck when it breaks, always at the worst time. And somewhere in there you&apos;re supposed to track a dozen federal deadlines that nobody reminds you about and that carry real consequences when you miss them.</Text>
          <Text style={styles.bodyText}>None of it is hard. That&apos;s the part that used to make me crazy. Updating your MCS-150 takes ten minutes and costs nothing. Filing your UCR is a form. Running an MVR is a couple of clicks.</Text>
          <Text style={styles.pullQuote}>The hard part is knowing they exist, and knowing when.</Text>
          <Text style={styles.bodyText}>Your MCS-150 due date isn&apos;t on a calendar anywhere—it&apos;s buried in the digits of your USDOT number, and most owner-operators have never been told the rule. Your IFTA return is due in a quarter where you didn&apos;t turn a wheel. Your medical card is good for two years or three months depending on what your blood pressure did that morning. Your Clearinghouse query runs 365 days from the last one, not on January 1.</Text>
          <Text style={styles.bodyText}>Nobody hands you that list when you get your authority.</Text>
          <Text style={styles.storyClose}>So I built the list. Then I built the software that watches it.</Text>
        </StorySection>

        <View style={styles.greenSection}><View style={styles.greenInner}>
          <Text style={styles.eyebrow}>WHY I&apos;M STILL HERE</Text>
          <Text style={[styles.sectionTitle, compact && styles.sectionTitleCompact]}>Selling the trucks was the end of hauling, not the end of caring about this business.</Text>
          <Text style={styles.greenText}>I know what it costs to run one. I know what a $50 late fee feels like in February when you&apos;re waiting on a broker. I know what it&apos;s like to find out about a rule change after it already cost you something.</Text>
          <Text style={styles.greenText}>That&apos;s why this is $2 a month plus $1 per driver. One truck costs three dollars. I&apos;d rather have a lot of small carriers than a few big ones, and I&apos;d rather you spend the money on tires.</Text>
        </View></View>

        <StorySection compact={compact} eyebrow="THE PART I ACTUALLY CARE ABOUT" title="FMCSA changes things constantly.">
          <Text style={styles.bodyText}>In the last few years, the annual list of violations was eliminated, medical certification moved to electronic reporting, prohibited Clearinghouse status began triggering CDL downgrades, and the federal registration process moved into Motus. USDOT PINs are no longer needed for registration transactions.</Text>
          <Text style={styles.bodyText}>Every one of those changes broke somebody&apos;s process. Most people found out late. Some found out at a scale house.</Text>
          <Text style={styles.bodyText}>Nobody running one truck has time to read the Federal Register. I do it now, because it&apos;s my job instead of the thing I squeezed in after dispatch. When something changes, I update the software and tell you what it means.</Text>
        </StorySection>

        <View style={styles.darkSection}>
          <View style={styles.darkInner}>
            <Text style={styles.darkEyebrow}>WHAT THIS IS NOT</Text>

            <Text style={[styles.darkTitle, compact && styles.darkTitleCompact]}>
              I&apos;m not a compliance service.
            </Text>

            <Text style={styles.darkText}>
              I don&apos;t file your paperwork, and I&apos;m not going to sell you insurance or factoring on the side.
            </Text>
            <Text style={styles.darkText}>Most of these filings are free or under $50 direct. The companies charging a premium to click the buttons aren&apos;t solving your real problem. Your real problem is that nobody told you the deadline was coming.</Text>
            <Text style={styles.darkClose}>That&apos;s the part I fixed.</Text>
            <Text style={styles.disclaimerText}>We Heart Paperwork is an organization and reminder tool. It does not provide legal advice or guarantee regulatory compliance.</Text>
          </View>
        </View>

        <View style={styles.finalSection}>
          <View style={[styles.finalCard, compact && styles.finalCardCompact]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.finalEyebrow}>WE HEART PAPERWORK</Text>
              <Text style={[styles.finalTitle, compact && styles.finalTitleCompact]}>
                Built in the industry. Still working for it.
              </Text>
            </View>

            <View style={[styles.finalActions, compact && styles.finalActionsCompact]}>
              <Link href="/features" asChild><Pressable style={styles.finalButton}><Text style={styles.finalButtonText}>See what it tracks</Text></Pressable></Link>
              <Link href="/pricing" asChild><Pressable style={styles.finalButtonSecondary}><Text style={styles.finalButtonSecondaryText}>See pricing</Text></Pressable></Link>
            </View>
          </View>
        </View>

        <Footer compact={compact} />
      </ScrollView>
    </>
  );
}

function StorySection({
  compact,
  eyebrow,
  title,
  children,
}: {
  compact: boolean;
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={[styles.sectionTitle, compact && styles.sectionTitleCompact]}>{title}</Text>
      <View style={styles.storyCopy}>{children}</View>
    </View>
  );
}


function ValueCard({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <View style={styles.valueCard}>
      <Text style={styles.valueNumber}>{number}</Text>
      <Text style={styles.valueTitle}>{title}</Text>
      <Text style={styles.valueText}>{text}</Text>
    </View>
  );
}

function Footer({ compact }: { compact: boolean }) {
  return (
    <>
      <View style={[styles.footer, compact && styles.footerCompact]}>
        <View>
          <Text style={styles.footerBrand}>We Heart Paperwork</Text>
          <Text style={styles.footerDescription}>
            Practical compliance organization for trucking companies.
          </Text>
        </View>

        <View style={styles.footerLinks}>
          <Link href="/features" asChild><Pressable><Text style={styles.footerLink}>Features</Text></Pressable></Link>
          <Link href="/pricing" asChild><Pressable><Text style={styles.footerLink}>Pricing</Text></Pressable></Link>
          <Link href="/tools/mcs-150-due-date-calculator" asChild><Pressable><Text style={styles.footerLink}>Free MCS-150 Tool</Text></Pressable></Link>
          <Link href="/support" asChild><Pressable><Text style={styles.footerLink}>Support</Text></Pressable></Link>
          <Link href="/privacy" asChild><Pressable><Text style={styles.footerLink}>Privacy</Text></Pressable></Link>
        </View>
      </View>

      <View style={[styles.legal, compact && styles.legalCompact]}>
        <Text style={styles.legalText}>{"\u00A9"} 2026 We Heart Paperwork</Text>
        <Text style={styles.legalText}>
          We Heart Paperwork helps organize compliance information and does
          not provide legal advice or guarantee regulatory compliance.
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#FAFAF8" },
  pageContent: { minHeight: "100%" },
  header: { borderBottomWidth: 1, borderBottomColor: "#E5E3DA", backgroundColor: "#FAFAF8" },
  headerInner: { width: "100%", maxWidth: 1120, alignSelf: "center", minHeight: 72, paddingHorizontal: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 20 },
  headerInnerCompact: { minHeight: 68, paddingHorizontal: 18, gap: 12 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  logo: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#27500A" },
  logoText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  brandName: { color: "#1A1915", fontSize: 16, fontWeight: "700" },
  headerLinks: { flexDirection: "row", alignItems: "center", gap: 20 },
  headerLinksCompact: { gap: 12 },
  headerLink: { color: "#706E68", fontSize: 14, fontWeight: "500" },
  headerLinkActive: { color: "#27500A", fontWeight: "800" },
  loginButton: { minHeight: 40, paddingHorizontal: 16, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#27500A" },
  loginButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  hero: { width: "100%", maxWidth: 1120, alignSelf: "center", paddingHorizontal: 24, paddingTop: 92, paddingBottom: 92 },
  heroCompact: { paddingHorizontal: 18, paddingTop: 56, paddingBottom: 64 },
  eyebrow: { marginBottom: 14, color: "#3B6D11", fontSize: 12, lineHeight: 17, fontWeight: "800", letterSpacing: 1.2 },
  heroTitle: { color: "#1A1915", fontSize: 56, lineHeight: 59, fontWeight: "800", letterSpacing: -2.6 },
  heroAccent: { color: "#3B6D11", fontSize: 56, lineHeight: 59, fontWeight: "800", letterSpacing: -2.6 },
  heroTitleCompact: { fontSize: 40, lineHeight: 43, letterSpacing: -1.6 },
  heroDescription: { maxWidth: 780, marginTop: 26, color: "#5F5D57", fontSize: 19, lineHeight: 31 },
  section: { width: "100%", maxWidth: 1120, alignSelf: "center", paddingHorizontal: 24, paddingVertical: 100 },
  sectionTitle: { maxWidth: 860, color: "#1A1915", fontSize: 46, lineHeight: 50, fontWeight: "800", letterSpacing: -1.9 },
  sectionTitleCompact: { fontSize: 34, lineHeight: 38, letterSpacing: -1.1 },
  copyLayout: { marginTop: 44, flexDirection: "row", gap: 60 },
  copyLayoutCompact: { flexDirection: "column", gap: 18 },
  copyColumn: { flex: 1 },
  bodyText: { marginBottom: 20, color: "#5F5D57", fontSize: 17, lineHeight: 29 },
  storyCopy: { maxWidth: 780, marginTop: 40 },
  storyClose: { marginTop: 8, color: "#1A1915", fontSize: 21, lineHeight: 31, fontWeight: "800" },
  pullQuote: { paddingLeft: 20, borderLeftWidth: 3, borderLeftColor: "#3B6D11", color: "#1A1915", fontSize: 20, lineHeight: 31, fontWeight: "700" },
  greenSection: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#D6E4C9", backgroundColor: "#EEF4E9" },
  greenInner: { width: "100%", maxWidth: 1120, alignSelf: "center", paddingHorizontal: 24, paddingVertical: 100 },
  greenText: { maxWidth: 760, marginTop: 24, color: "#5F5D57", fontSize: 18, lineHeight: 30 },
  primaryButton: { alignSelf: "flex-start", minHeight: 50, marginTop: 28, paddingHorizontal: 20, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#27500A" },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  valuesGrid: { marginTop: 44, flexDirection: "row", gap: 18 },
  valuesGridCompact: { flexDirection: "column" },
  valueCard: { flex: 1, minHeight: 230, padding: 26, borderWidth: 1, borderColor: "#E5E3DA", borderRadius: 20, backgroundColor: "#FFFFFF" },
  valueNumber: { marginBottom: 42, color: "#3B6D11", fontSize: 12, fontWeight: "800" },
  valueTitle: { marginBottom: 10, color: "#1A1915", fontSize: 21, fontWeight: "800" },
  valueText: { color: "#5F5D57", fontSize: 15, lineHeight: 24 },
  darkSection: { backgroundColor: "#1A1915" },
  darkInner: { width: "100%", maxWidth: 1120, alignSelf: "center", paddingHorizontal: 24, paddingVertical: 100 },
  darkEyebrow: { marginBottom: 14, color: "#B8D5A2", fontSize: 12, fontWeight: "800", letterSpacing: 1.2 },
  darkTitle: { maxWidth: 820, color: "#FFFFFF", fontSize: 46, lineHeight: 50, fontWeight: "800", letterSpacing: -1.9 },
  darkTitleCompact: { fontSize: 34, lineHeight: 38, letterSpacing: -1.1 },
  darkText: { maxWidth: 760, marginTop: 24, color: "#D5D3CC", fontSize: 18, lineHeight: 30 },
  darkClose: { maxWidth: 760, marginTop: 28, color: "#FFFFFF", fontSize: 25, lineHeight: 32, fontWeight: "800" },
  disclaimerText: { maxWidth: 760, marginTop: 34, color: "#9F9D96", fontSize: 12, lineHeight: 19 },
  finalSection: { width: "100%", maxWidth: 1120, alignSelf: "center", paddingHorizontal: 24, paddingVertical: 90 },
  finalCard: { padding: 40, borderRadius: 24, backgroundColor: "#1A1915", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 30 },
  finalCardCompact: { padding: 30, flexDirection: "column", alignItems: "flex-start" },
  finalEyebrow: { marginBottom: 12, color: "#B8D5A2", fontSize: 12, fontWeight: "800", letterSpacing: 1.2 },
  finalTitle: { color: "#FFFFFF", fontSize: 38, lineHeight: 42, fontWeight: "800", letterSpacing: -1.4 },
  finalTitleCompact: { fontSize: 30, lineHeight: 34 },
  finalButton: { minHeight: 50, paddingHorizontal: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  finalButtonText: { color: "#27500A", fontSize: 14, fontWeight: "800" },
  finalActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  finalActionsCompact: { width: "100%", flexDirection: "column", alignItems: "stretch" },
  finalButtonSecondary: { minHeight: 50, paddingHorizontal: 22, borderWidth: 1, borderColor: "#6E6B64", borderRadius: 11, alignItems: "center", justifyContent: "center" },
  finalButtonSecondaryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  footer: { width: "100%", maxWidth: 1120, alignSelf: "center", paddingHorizontal: 24, paddingTop: 50, paddingBottom: 32, borderTopWidth: 1, borderTopColor: "#E5E3DA", flexDirection: "row", justifyContent: "space-between", gap: 30 },
  footerCompact: { flexDirection: "column" },
  footerBrand: { color: "#1A1915", fontSize: 16, fontWeight: "800" },
  footerDescription: { marginTop: 8, color: "#706E68", fontSize: 13 },
  footerLinks: { flexDirection: "row", flexWrap: "wrap", gap: 20 },
  footerLink: { color: "#706E68", fontSize: 13 },
  legal: { width: "100%", maxWidth: 1120, alignSelf: "center", paddingHorizontal: 24, paddingTop: 24, paddingBottom: 34, borderTopWidth: 1, borderTopColor: "#E5E3DA", flexDirection: "row", justifyContent: "space-between", gap: 30 },
  legalCompact: { flexDirection: "column", gap: 10 },
  legalText: { maxWidth: 650, color: "#8A8880", fontSize: 11, lineHeight: 17 },
});
