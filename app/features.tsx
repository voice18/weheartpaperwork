import PublicHeader from "../components/public/PublicHeader";
import { Link } from "expo-router";
import Head from "expo-router/head";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { usePublicCompact } from "../hooks/usePublicCompact";

export default function FeaturesPage() {
  const compact = usePublicCompact();

  return (
    <>
      <Head>
        <title>FMCSA Compliance Tracking Features | We Heart Paperwork</title>
        <meta
          name="description"
          content="Track quarterly IFTA returns, built-in and custom company deadlines, driver qualification setup, vehicle registration, DOT inspections, reminders, and history."
        />
        <link rel="canonical" href="https://weheartpaperwork.com/features" />
      </Head>

      <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
        <PublicHeader />

        <View style={[styles.hero, compact && styles.heroCompact]}>
          <Text style={styles.eyebrow}>WHAT WE HEART PAPERWORK TRACKS</Text>
          <Text style={[styles.heroTitle, compact && styles.heroTitleCompact]}>
            See what needs attention.
          </Text>
          <Text style={[styles.heroAccent, compact && styles.heroTitleCompact]}>
            Keep the paperwork moving.
          </Text>
          <Text style={styles.heroDescription}>
            We Heart Paperwork keeps recurring company, driver, truck, and
            trailer deadlines, reminders, and completion history together in
            one clear dashboard.
          </Text>
          <View style={styles.heroButtons}>
            <Link href="/pricing" asChild>
              <Pressable style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>See pricing</Text>
              </Pressable>
            </Link>
            <Link href={{ pathname: "/(auth)/login", params: { mode: "create" } }} asChild>
              <Pressable style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Create account</Text>
              </Pressable>
            </Link>
          </View>
        </View>

        <FeatureSection
          compact={compact}
          number="01"
          eyebrow="COMPANY DEADLINES"
          title="Keep recurring company requirements visible."
          description="Instead of relying on memory, scattered calendars, or notes, keep important dates in one place and record when the work was completed."
          items={[
          [
            "MCS-150 biennial update",
            "Track the scheduled biennial update date tied to your USDOT number and keep the next due date visible.",
          ],
          [
            "UCR registration",
            "Keep the annual UCR registration cycle visible so it does not disappear into the rest of the year.",
          ],
          [
            "Form 2290",
            "Track the annual heavy vehicle use tax deadline and record completion when the filing is handled.",
          ],
          [
            "IFTA license & decals",
            "Track the annual renewal of your IFTA license and decals through your base jurisdiction.",
          ],
          [
            "IFTA quarterly returns",
            "Track April 30, July 31, October 31, and January 31 filings separately from annual credentials, or mark them not applicable for your operation.",
          ],
          [
            "IRP apportioned registration",
            "Track the actual expiration or renewal date for your apportioned registration.",
          ],
          [
            "Commercial auto insurance",
            "Track the expiration date shown on your current commercial auto insurance policy.",
          ],
          [
            "Drug & alcohol consortium renewal",
            "Track the provider-specific renewal date so continuous enrollment in your DOT testing program does not quietly lapse.",
          ],
          [
            "BOC-3 process agent",
            "Keep your process-agent designation status recorded with the rest of the company compliance picture.",
          ],
          [
            "FMCSA Portal and Motus access",
            "Keep Portal access active for systems that still use it while using Motus for current FMCSA registration work.",
          ],
          [
            "Custom company requirements",
            "Add as many company- or state-specific requirements as needed, with fixed dates, calendar-monthly or quarterly periods, other recurring intervals, reminders, and completion history.",
          ],
        ]}
        />

        <FeatureSection
          compact={compact}
          number="02"
          eyebrow="DRIVER COMPLIANCE"
          title="Each driver gets their own dates and setup record."
          items={[
            [
              "CDL expiration",
              "Save each driver's actual CDL expiration date along with their license number, class, and state.",
            ],
            [
              "Medical qualification expiration",
              "Track the actual expiration date that applies to each driver's current medical qualification.",
            ],
            [
              "Annual MVR review",
              "Track the date of the driver's most recent annual MVR review and keep the next annual cycle visible.",
            ],
            [
              "Clearinghouse annual query",
              "Track each driver's most recent annual Clearinghouse query on its recurring schedule.",
            ],
            [
              "Driver qualification setup",
              "Confirm core file records, the pre-employment Clearinghouse query, drug-test or exception status, and the previous-employer safety investigation without crowding recurring deadlines.",
            ],
            [
              "Completion history",
              "Keep a practical record of recurring compliance work that was completed and the dates associated with it.",
            ],
          ]}
        />

        <FeatureSection
          compact={compact}
          number="03"
          eyebrow="FLEET COMPLIANCE"
          title="Keep every truck and trailer clearly separated."
          description="Each active vehicle has its own identity, deadlines, and history, while sold or removed equipment stays available without continuing to send reminders."
          items={[
            [
              "Truck and trailer records",
              "Organize trucks and trailers in separate sections with unit number, VIN, plate, state, and optional equipment details.",
            ],
            [
              "Registration expiration",
              "Track the actual registration expiration date for each truck and trailer and record annual renewals.",
            ],
            [
              "Annual DOT inspection",
              "Track each annual inspection deadline from the date the inspection was completed.",
            ],
            [
              "Vehicle completion history",
              "Keep registration and inspection history collapsed until you need to review it.",
            ],
            [
              "Sold or removed equipment",
              "Stop reminders without losing the vehicle record, then restore it later if needed.",
            ],
            [
              "Fleet reminders",
              "Include approaching truck and trailer deadlines in the same dashboard and notification schedule.",
            ],
          ]}
        />

        <View style={styles.section}>
          <Text style={styles.eyebrow}>REMINDERS WITHOUT THE NOISE</Text>
          <Text style={[styles.sectionTitle, compact && styles.sectionTitleCompact]}>
            Know what is coming before it turns into a scramble.
          </Text>

          <View style={[styles.split, compact && styles.splitCompact]}>
            <InfoCard
              title="Upcoming work stays visible"
              text="The dashboard separates overdue, due-soon, and upcoming work so you can see where attention is needed without digging through every record."
            />
            <InfoCard
              title="Completion does not disappear"
              text="When you mark work complete, We Heart Paperwork keeps a history of the action and the next due date when the requirement is recurring."
            />
          </View>
        </View>

        <View style={styles.philosophy}>
          <View style={styles.section}>
            <Text style={styles.eyebrow}>INTENTIONALLY SIMPLE</Text>
            <Text style={[styles.sectionTitle, compact && styles.sectionTitleCompact]}>
              Compliance tracking should reduce work, not create another system to manage.
            </Text>
            <Text style={styles.sectionDescription}>
              You handle the filings and decisions. We Heart Paperwork keeps
              the dates, reminders, setup confirmations, and completion
              history organized. That is the feature—not a hidden limitation
              or an expensive managed-service layer.
            </Text>
          </View>
        </View>

        <View style={styles.finalSection}>
          <View style={[styles.finalCard, compact && styles.finalCardCompact]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.finalEyebrow}>WE HEART PAPERWORK</Text>
              <Text style={[styles.finalTitle, compact && styles.finalTitleCompact]}>
                One clear place for the paperwork that keeps coming back.
              </Text>
            </View>
            <Link href="/pricing" asChild>
              <Pressable style={styles.finalButton}>
                <Text style={styles.finalButtonText}>See pricing</Text>
              </Pressable>
            </Link>
          </View>
        </View>

        <Footer compact={compact} />
      </ScrollView>
    </>
  );
}

function FeatureSection({
  compact,
  number,
  eyebrow,
  title,
  description,
  items,
}: {
  compact: boolean;
  number: string;
  eyebrow: string;
  title: string;
  description?: string;
  items: [string, string][];
}) {
  return (
    <View style={[styles.trackSection, compact && styles.trackSectionCompact]}>
      <View style={styles.trackHeading}>
        <Text style={styles.trackNumber}>{number}</Text>
        <View style={styles.trackHeadingCopy}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={[styles.trackTitle, compact && styles.trackTitleCompact]}>{title}</Text>
          {description ? <Text style={styles.trackDescription}>{description}</Text> : null}
        </View>
      </View>
      <View style={styles.trackList}>
        {items.map(([itemTitle, itemText]) => (
          <View key={itemTitle} style={[styles.trackRow, compact && styles.trackRowCompact]}>
            <Text style={styles.trackBullet}>•</Text>
            <View style={styles.trackRowCopy}>
              <Text style={styles.trackItemTitle}>{itemTitle}</Text>
              <Text style={styles.trackItemText}>{itemText}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function InfoCard({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.infoCard}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardText}>{text}</Text>
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
          <Link href="/about" asChild><Pressable><Text style={styles.footerLink}>About</Text></Pressable></Link>
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
  heroTitle: { maxWidth: 900, color: "#1A1915", fontSize: 56, lineHeight: 59, fontWeight: "800", letterSpacing: -2.6 },
  heroAccent: { maxWidth: 900, color: "#3B6D11", fontSize: 56, lineHeight: 59, fontWeight: "800", letterSpacing: -2.6 },
  heroTitleCompact: { fontSize: 40, lineHeight: 43, letterSpacing: -1.6 },
  heroDescription: { maxWidth: 760, marginTop: 26, color: "#5F5D57", fontSize: 19, lineHeight: 30 },
  heroButtons: { marginTop: 30, flexDirection: "row", flexWrap: "wrap", gap: 12 },
  primaryButton: { minHeight: 50, paddingHorizontal: 20, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#27500A" },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  secondaryButton: { minHeight: 50, paddingHorizontal: 20, borderWidth: 1, borderColor: "#D3D1C7", borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  secondaryButtonText: { color: "#27500A", fontSize: 14, fontWeight: "700" },
  section: { width: "100%", maxWidth: 1120, alignSelf: "center", paddingHorizontal: 24, paddingVertical: 100 },
  sectionTitle: { maxWidth: 820, color: "#1A1915", fontSize: 46, lineHeight: 50, fontWeight: "800", letterSpacing: -1.9 },
  sectionTitleCompact: { fontSize: 34, lineHeight: 38, letterSpacing: -1.1 },
  sectionDescription: { maxWidth: 760, marginTop: 22, color: "#5F5D57", fontSize: 18, lineHeight: 29 },
  trackSection: { width: "100%", maxWidth: 1080, alignSelf: "center", marginBottom: 22, padding: 30, borderWidth: 1, borderColor: "#E5E3DA", borderRadius: 20, backgroundColor: "#FFFFFF" },
  trackSectionCompact: { width: "auto", marginHorizontal: 18, marginBottom: 15, padding: 20, borderRadius: 16 },
  trackHeading: { flexDirection: "row", alignItems: "flex-start", gap: 20 },
  trackNumber: { width: 24, color: "#3B6D11", fontSize: 12, fontWeight: "800" },
  trackHeadingCopy: { flex: 1 },
  trackTitle: { color: "#1A1915", fontSize: 29, lineHeight: 35, fontWeight: "800" },
  trackTitleCompact: { fontSize: 23, lineHeight: 29 },
  trackDescription: { maxWidth: 760, marginTop: 8, color: "#5F5D57", fontSize: 14, lineHeight: 22 },
  trackList: { marginTop: 24, borderTopWidth: 1, borderTopColor: "#E5E3DA" },
  trackRow: { minHeight: 76, paddingVertical: 14, flexDirection: "row", alignItems: "flex-start", gap: 14, borderBottomWidth: 1, borderBottomColor: "#E5E3DA" },
  trackRowCompact: { paddingVertical: 13 },
  trackBullet: { width: 24, color: "#3B6D11", fontSize: 17, lineHeight: 22, fontWeight: "800", textAlign: "center" },
  trackRowCopy: { flex: 1 },
  trackItemTitle: { color: "#27500A", fontSize: 15, lineHeight: 21, fontWeight: "800" },
  trackItemText: { marginTop: 3, color: "#5F5D57", fontSize: 14, lineHeight: 21 },
  cardTitle: { marginBottom: 10, color: "#1A1915", fontSize: 20, fontWeight: "800" },
  cardText: { color: "#5F5D57", fontSize: 15, lineHeight: 24 },
  split: { marginTop: 44, flexDirection: "row", gap: 18 },
  splitCompact: { flexDirection: "column" },
  infoCard: { flex: 1, padding: 30, borderWidth: 1, borderColor: "#E5E3DA", borderRadius: 20, backgroundColor: "#FFFFFF" },
  philosophy: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#E5E3DA", backgroundColor: "#F4F3EE" },
  finalSection: { width: "100%", maxWidth: 1120, alignSelf: "center", paddingHorizontal: 24, paddingVertical: 90 },
  finalCard: { padding: 40, borderRadius: 24, backgroundColor: "#1A1915", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 30 },
  finalCardCompact: { padding: 30, flexDirection: "column", alignItems: "flex-start" },
  finalEyebrow: { marginBottom: 12, color: "#B8D5A2", fontSize: 12, fontWeight: "800", letterSpacing: 1.2 },
  finalTitle: { color: "#FFFFFF", fontSize: 38, lineHeight: 42, fontWeight: "800", letterSpacing: -1.4 },
  finalTitleCompact: { fontSize: 30, lineHeight: 34 },
  finalButton: { minHeight: 50, paddingHorizontal: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  finalButtonText: { color: "#27500A", fontSize: 14, fontWeight: "800" },
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
