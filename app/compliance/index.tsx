import { Link } from "expo-router";
import PublicHeader from "../../components/public/PublicHeader";
import AuditToolCard from "../../components/public/AuditToolCard";
import Head from "expo-router/head";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { usePublicCompact } from "../../hooks/usePublicCompact";

import { compliancePages } from "../../lib/publicCompliancePages";

export default function ComplianceGuidesIndexPage() {
  const compact = usePublicCompact();

  return (
    <>
      <Head>
        <title>Trucking Compliance Guides | We Heart Paperwork</title>
        <meta
          name="description"
          content="Plain-English guides to MCS-150, UCR, Form 2290 and IFTA deadlines, built from official FMCSA, UCR, IRS and IFTA sources."
        />
        <link rel="canonical" href="https://weheartpaperwork.com/compliance" />
      </Head>

      <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
        <PublicHeader />

        <View style={[styles.hero, compact && styles.heroCompact]}>
          <Text style={styles.eyebrow}>COMPLIANCE GUIDES</Text>
          <Text style={[styles.heroTitle, compact && styles.heroTitleCompact]}>
            The paperwork is easier when you know what the clock is doing.
          </Text>
          <Text style={styles.heroDescription}>
            Practical explanations of the recurring requirements We Heart Paperwork tracks.
            Every guide shows when it was reviewed and links back to the official source.
          </Text>
        </View>

        <View style={styles.resourceSection}>
          <Text style={styles.eyebrow}>START HERE</Text>
          <Text style={[styles.sectionTitle, compact && styles.sectionTitleCompact]}>
            Pick the kind of help you actually need.
          </Text>
          <View style={[styles.grid, compact && styles.gridCompact]}>
            <AuditToolCard />
            <AuditToolCard tool="dq" />
            <AuditToolCard tool="maintenance" />
            <AuditToolCard tool="accident" />
            <ResourceCard
              href="/how-to"
              title="How to get it done"
              text="Step-by-step filing pathways: what to gather, where to go, what to save, and what to track next."
            />
            <ResourceCard
              href="/compliance-service-or-tracker"
              title="Compliance service or tracker?"
              text="A plain comparison for carriers deciding between managed help and a system for doing the work themselves."
            />
            <ResourceCard
              href="/for-owner-operators"
              title="Built for owner-operators"
              text="See the company, driver, truck, and trailer dates that can pile up even when the fleet is one truck."
            />
            <ResourceCard
              href="/fmcsa-updates"
              title="FMCSA updates"
              text="A dated record of registration and compliance changes that affect small carriers."
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.eyebrow}>REQUIREMENT-BY-REQUIREMENT</Text>
          <View style={[styles.grid, compact && styles.gridCompact]}>
            {compliancePages.map((page, index) => (
              <Link
                key={page.slug}
                href={{ pathname: "/compliance/[slug]", params: { slug: page.slug } }}
                asChild
              >
                <Pressable style={styles.card}>
                  <Text style={styles.cardNumber}>{String(index + 1).padStart(2, "0")}</Text>
                  <Text style={styles.cardEyebrow}>{page.eyebrow}</Text>
                  <Text style={styles.cardTitle}>{page.title}</Text>
                  <Text style={styles.cardText} numberOfLines={4}>{page.shortVersion}</Text>
                  <View style={styles.cardFooter}>
                    <Text style={styles.cardReviewed}>Reviewed {page.lastReviewed}</Text>
                    <Text style={styles.cardArrow}>→</Text>
                  </View>
                </Pressable>
              </Link>
            ))}
          </View>
        </View>

        <View style={styles.greenSection}>
          <View style={styles.greenInner}>
            <Text style={styles.eyebrow}>START WITH THE ONE PEOPLE FORGET</Text>
            <Text style={[styles.sectionTitle, compact && styles.sectionTitleCompact]}>
              Your MCS-150 schedule is hidden in your USDOT number.
            </Text>
            <Text style={styles.greenText}>
              Use the free calculator to see the scheduled month and odd/even filing year instantly.
            </Text>
            <Link href="/tools/mcs-150-due-date-calculator" asChild>
              <Pressable style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Free MCS-150 calculator</Text>
              </Pressable>
            </Link>
          </View>
        </View>

        <Footer compact={compact} />
      </ScrollView>
    </>
  );
}

function ResourceCard({ href, title, text }: { href: string; title: string; text: string }) {
  return (
    <Link href={href as any} asChild>
      <Pressable style={styles.resourceCard}>
        <Text style={styles.resourceTitle}>{title}</Text>
        <Text style={styles.resourceText}>{text}</Text>
        <Text style={styles.resourceArrow}>Read more →</Text>
      </Pressable>
    </Link>
  );
}



function Footer({ compact }: { compact: boolean }) {
  return (
    <>
      <View style={[styles.footer, compact && styles.footerCompact]}>
        <View>
          <Text style={styles.footerBrand}>We Heart Paperwork</Text>
          <Text style={styles.footerDescription}>Practical compliance organization for trucking companies.</Text>
        </View>
        <View style={styles.footerLinks}>
          <Link href="/features" asChild><Pressable><Text style={styles.footerLink}>Features</Text></Pressable></Link>
          <Link href="/pricing" asChild><Pressable><Text style={styles.footerLink}>Pricing</Text></Pressable></Link>
          <Link href="/about" asChild><Pressable><Text style={styles.footerLink}>About</Text></Pressable></Link>
          <Link href="/tools/mcs-150-due-date-calculator" asChild><Pressable><Text style={styles.footerLink}>Free MCS-150 Tool</Text></Pressable></Link>
          <Link href="/support" asChild><Pressable><Text style={styles.footerLink}>Support</Text></Pressable></Link>
          <Link href="/privacy" asChild><Pressable><Text style={styles.footerLink}>Privacy</Text></Pressable></Link>
        </View>
      </View>
      <View style={[styles.legal, compact && styles.legalCompact]}>
        <Text style={styles.legalText}>{"\u00A9"} 2026 We Heart Paperwork</Text>
        <Text style={styles.legalText}>General information only. We Heart Paperwork does not provide legal advice or guarantee regulatory compliance.</Text>
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
  hero: { width: "100%", maxWidth: 1120, alignSelf: "center", paddingHorizontal: 24, paddingTop: 92, paddingBottom: 72 },
  heroCompact: { paddingHorizontal: 18, paddingTop: 56, paddingBottom: 52 },
  eyebrow: { marginBottom: 14, color: "#3B6D11", fontSize: 12, lineHeight: 17, fontWeight: "800", letterSpacing: 1.2 },
  heroTitle: { maxWidth: 900, color: "#1A1915", fontSize: 54, lineHeight: 58, fontWeight: "800", letterSpacing: -2.3 },
  heroTitleCompact: { fontSize: 38, lineHeight: 42, letterSpacing: -1.4 },
  heroDescription: { maxWidth: 760, marginTop: 24, color: "#5F5D57", fontSize: 19, lineHeight: 31 },
  section: { width: "100%", maxWidth: 1120, alignSelf: "center", paddingHorizontal: 24, paddingTop: 20, paddingBottom: 100 },
  resourceSection: { width: "100%", maxWidth: 1120, alignSelf: "center", paddingHorizontal: 24, paddingBottom: 70 },
  resourceCard: { flexGrow: 1, flexBasis: 280, minHeight: 210, padding: 24, borderWidth: 1, borderColor: "#D6E4C9", borderRadius: 18, backgroundColor: "#EEF4E9" },
  resourceTitle: { color: "#1A1915", fontSize: 20, lineHeight: 25, fontWeight: "800" },
  resourceText: { marginTop: 10, color: "#5F5D57", fontSize: 14, lineHeight: 23 },
  resourceArrow: { marginTop: "auto", paddingTop: 18, color: "#27500A", fontSize: 13, fontWeight: "800" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 18 },
  gridCompact: { flexDirection: "column" },
  card: { width: "48.5%", minWidth: 300, minHeight: 310, padding: 28, borderWidth: 1, borderColor: "#E5E3DA", borderRadius: 22, backgroundColor: "#FFFFFF" },
  cardNumber: { color: "#3B6D11", fontSize: 12, fontWeight: "800" },
  cardEyebrow: { marginTop: 42, color: "#706E68", fontSize: 10, fontWeight: "800", letterSpacing: 1.1 },
  cardTitle: { marginTop: 9, color: "#1A1915", fontSize: 23, lineHeight: 28, fontWeight: "800", letterSpacing: -0.5 },
  cardText: { marginTop: 12, color: "#5F5D57", fontSize: 14, lineHeight: 23 },
  cardFooter: { marginTop: "auto", paddingTop: 22, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  cardReviewed: { color: "#8A8880", fontSize: 11 },
  cardArrow: { color: "#27500A", fontSize: 20, fontWeight: "800" },
  greenSection: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#D6E4C9", backgroundColor: "#EEF4E9" },
  greenInner: { width: "100%", maxWidth: 1120, alignSelf: "center", paddingHorizontal: 24, paddingVertical: 100 },
  sectionTitle: { maxWidth: 820, color: "#1A1915", fontSize: 46, lineHeight: 50, fontWeight: "800", letterSpacing: -1.9 },
  sectionTitleCompact: { fontSize: 34, lineHeight: 38, letterSpacing: -1.1 },
  greenText: { maxWidth: 760, marginTop: 22, color: "#5F5D57", fontSize: 18, lineHeight: 29 },
  primaryButton: { alignSelf: "flex-start", minHeight: 50, marginTop: 28, paddingHorizontal: 20, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#27500A" },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
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
