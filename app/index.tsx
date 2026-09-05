import PublicHeader from "../components/public/PublicHeader";
import PublicFooter from "../components/public/PublicFooter";
import AuditToolCard from "../components/public/AuditToolCard";
import { Link } from "expo-router";
import Head from "expo-router/head";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function WebLandingPage() {
  return (
  <>
    <Head>
      <title>DOT Compliance Tracker | We Heart Paperwork</title>
      <meta
        name="description"
        content="A simple DOT compliance tracker for carriers who handle their own paperwork. Track company, driver, truck, and trailer deadlines from $3 a month."
      />
    </Head>

    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.pageContent}
    >
      <PublicHeader />
      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>
            BUILT BY A TRUCKING COMPANY. SHARED WITH YOURS.
          </Text>

          <Text style={styles.heroTitle}>
            Keep your trucks moving.
          </Text>

          <Text style={styles.heroTitleAccent}>
            {"We'll help with the paperwork."}
          </Text>

          <Text style={styles.heroDescription}>
            A simple deadline and recordkeeping system for carriers
            who handle their own compliance. Track company filings,
            driver qualification setup, quarterly IFTA returns, and
            truck and trailer renewals without paying for a managed
            compliance service.
          </Text>

          <View style={styles.heroButtons}>
            <Link href="/pricing" asChild>
              <Pressable style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>
                  See pricing
                </Text>
              </Pressable>
            </Link>

            <Link href={{ pathname: "/(auth)/login", params: { mode: "create" } }} asChild>
              <Pressable style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>
                  Create account
                </Text>
              </Pressable>
            </Link>
          </View>

          <Text style={styles.availability}>
            Built in Yakima, Washington. Available on iPhone and Android.
          </Text>
        </View>

        <DashboardPreview />
      </View>

      <View style={styles.auditToolSection}>
        <AuditToolCard />
        <AuditToolCard tool="dq" />
        <AuditToolCard tool="maintenance" />
        <AuditToolCard tool="accident" />
      </View>

      <View style={styles.section}>
        <Text style={styles.eyebrow}>
          LESS GUESSING. LESS SCRAMBLING.
        </Text>

        <Text style={styles.sectionTitle}>
          One place to see what needs attention.
        </Text>

        <View style={styles.featureGrid}>
          <FeatureCard
            number="01"
            title="Know what is coming"
            description="See company, driver, truck, and trailer deadlines before they become last-minute problems."
          />

          <FeatureCard
            number="02"
            title="Keep records organized"
            description="Track dates, completion status, and the information tied to each requirement."
          />

          <FeatureCard
            number="03"
            title="Build a clear history"
            description="Keep a practical record of what was completed, when it was completed, and what is due next."
          />
        </View>
      </View>


      <View style={styles.referralSection}>
        <View style={styles.referralInner}>
          <View style={styles.referralStory}>
            <Text style={styles.referralEyebrow}>
              WHY THIS COMPANY EXISTS
            </Text>

            <Text style={styles.referralTitle}>
              I built it for my company first.
            </Text>

            <Text style={styles.referralBody}>
              I own trucks. I built We Heart Paperwork because
              keeping up with company deadlines, driver files,
              renewals, and changing requirements was taking time
              away from the actual business. Once it worked for my
              operation, I wanted other trucking companies to have
              it too — without turning it into another overpriced
              software subscription.
            </Text>

            <Text style={styles.referralBody}>
              And if the people using We Heart Paperwork help it
              grow, I think they should benefit from that too.
            </Text>
          </View>

          <View style={styles.referralCard}>
            <Text style={styles.referralPercent}>10%</Text>
            <Text style={styles.referralCardLabel}>
              REFERRAL REWARD
            </Text>

            <Text style={styles.referralCardTitle}>
              Help us grow. We return the favor.
            </Text>

            <Text style={styles.referralCardText}>
              Eligible accounts can create a referral code. Earn 10% of
              qualifying subscription payments from companies you directly
              refer. The new company must claim your code within 24 hours
              of account creation. Refunds, credits and taxes are excluded;
              payout verification and program terms apply.
            </Text>

            <Text style={styles.referralCardTextStrong}>
                You helped us grow. That should matter.
              </Text>

              <Link href="/referrals" asChild>
                <Pressable
                  style={{
                    marginTop: 20,
                    alignSelf: "flex-start",
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    borderWidth: 1,
                    borderColor: "#5B5953",
                    borderRadius: 10,
                  }}
                >
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 15,
                      fontWeight: "700",
                    }}
                  >
                    Referral program details & terms →
                  </Text>
                </Pressable>
              </Link>

              <Text style={styles.referralFinePrint}>
                Referral rewards are compensation for successful
                referrals. They do not represent stock, equity, or
                ownership in We Heart Paperwork. Program terms apply.
              </Text>
          </View>
        </View>
      </View>

      <View style={styles.greenSection}>
        <View style={styles.greenSectionInner}>
          <View style={styles.greenSectionHeading}>
            <Text style={styles.eyebrow}>
              FOR CARRIERS WHO DO THEIR OWN PAPERWORK
            </Text>

            <Text style={styles.sectionTitle}>
              A compliance system, not a compliance service.
            </Text>
          </View>

          <Text style={styles.greenSectionText}>
            If you want someone to file forms, manage audits, and
            answer FMCSA for you, you need a full-service provider.
            If you are capable of handling the work and need one
            dependable place to see what is due, that is what We
            Heart Paperwork is built for. An owner-operator pays $36
            a year—less than the $50 minimum penalty for one late
            IFTA return.
          </Text>
          <View style={styles.positionLinks}>
            <Link href={"/compliance-service-or-tracker" as any} asChild>
              <Pressable style={styles.positionLinkButton}>
                <Text style={styles.positionLinkText}>Service or tracker?</Text>
              </Pressable>
            </Link>
            <Link href={"/for-owner-operators" as any} asChild>
              <Pressable style={styles.positionLinkButton}>
                <Text style={styles.positionLinkText}>For owner-operators</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </View>

      <View style={styles.finalSection}>
        <View style={styles.finalCard}>
          <View style={styles.finalCopy}>
            <Text style={styles.finalEyebrow}>
              WE HEART PAPERWORK
            </Text>

            <Text style={styles.finalTitle}>
              Built for my trucks. Shared with yours.
            </Text>
          </View>

          <Link
            href="/tools/mcs-150-due-date-calculator"
            asChild
          >
            <Pressable style={styles.finalButton}>
              <Text style={styles.finalButtonText}>
                Free MCS-150 calculator
              </Text>
            </Pressable>
          </Link>
        </View>
      </View>

      <PublicFooter />
        </ScrollView>
  </>
  );
}

function DashboardPreview() {
  return (
    <View style={styles.preview}>
      <View style={styles.previewHeader}>
        <View>
          <Text style={styles.previewCompany}>
            Your Trucking Company
          </Text>

          <Text style={styles.previewUsdot}>
            USDOT 123456
          </Text>
        </View>

        <View style={styles.allClearBadge}>
          <Text style={styles.allClearText}>All clear</Text>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <SummaryBox count="0" label="Overdue" />
        <SummaryBox count="2" label="Due soon" />
        <SummaryBox count="4" label="Upcoming" />
      </View>

      <View style={styles.requirementList}>
        <RequirementPreview
          title="MCS-150 update"
          subtitle="Company requirement"
          status="Tracked"
        />

        <RequirementPreview
          title="Annual driver MVR"
          subtitle="Driver requirement"
          status="Due soon"
          warning
        />

        <RequirementPreview
          title="Quarterly IFTA return"
          subtitle="Company requirement"
          status="Upcoming"
        />

        <RequirementPreview
          title="Trailer T-12 annual inspection"
          subtitle="Fleet requirement"
          status="Upcoming"
          last
        />
      </View>
    </View>
  );
}

function SummaryBox({
  count,
  label,
}: {
  count: string;
  label: string;
}) {
  return (
    <View style={styles.summaryBox}>
      <Text style={styles.summaryCount}>{count}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function RequirementPreview({
  title,
  subtitle,
  status,
  warning = false,
  last = false,
}: {
  title: string;
  subtitle: string;
  status: string;
  warning?: boolean;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.requirementPreview,
        last && styles.requirementPreviewLast,
      ]}
    >
      <View style={styles.requirementCopy}>
        <Text style={styles.requirementTitle}>
          {title}
        </Text>

        <Text style={styles.requirementSubtitle}>
          {subtitle}
        </Text>
      </View>

      <View
        style={[
          styles.requirementBadge,
          warning && styles.requirementBadgeWarning,
        ]}
      >
        <Text
          style={[
            styles.requirementBadgeText,
            warning &&
              styles.requirementBadgeWarningText,
          ]}
        >
          {status}
        </Text>
      </View>
    </View>
  );
}

function FeatureCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <View style={styles.featureCard}>
      <Text style={styles.featureNumber}>{number}</Text>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDescription}>
        {description}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#FAFAF8",
  },

  pageContent: {
    minHeight: "100%",
  },

  header: {
    borderBottomWidth: 1,
    borderBottomColor: "#E5E3DA",
    backgroundColor: "#FAFAF8",
  },

  headerInner: {
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
    minHeight: 72,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
  },

  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },

  logo: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#27500A",
  },

  logoText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  brandName: {
    color: "#1A1915",
    fontSize: 16,
    fontWeight: "700",
  },

  headerLinks: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },

  headerLink: {
    color: "#706E68",
    fontSize: 14,
    fontWeight: "500",
  },

  loginButton: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#27500A",
  },

  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  hero: {
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 92,
    paddingBottom: 92,
    flexDirection: "row",
    alignItems: "center",
    gap: 64,
  },

  heroCopy: {
    flex: 1.05,
    minWidth: 300,
  },

  eyebrow: {
    marginBottom: 14,
    color: "#3B6D11",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
    letterSpacing: 1.2,
  },

  heroTitle: {
    color: "#1A1915",
    fontSize: 60,
    lineHeight: 62,
    fontWeight: "800",
    letterSpacing: -2.8,
  },

  heroTitleAccent: {
    color: "#3B6D11",
    fontSize: 60,
    lineHeight: 62,
    fontWeight: "800",
    letterSpacing: -2.8,
  },

  heroDescription: {
    maxWidth: 590,
    marginTop: 26,
    color: "#5F5D57",
    fontSize: 20,
    lineHeight: 31,
  },

  heroButtons: {
    marginTop: 30,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  primaryButton: {
    minHeight: 50,
    paddingHorizontal: 20,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#27500A",
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  secondaryButton: {
    minHeight: 50,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "#D3D1C7",
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },

  secondaryButtonText: {
    color: "#27500A",
    fontSize: 14,
    fontWeight: "700",
  },

  availability: {
    marginTop: 18,
    color: "#706E68",
    fontSize: 13,
    lineHeight: 19,
  },

  preview: {
    flex: 0.95,
    minWidth: 330,
    maxWidth: 500,
    padding: 24,
    borderWidth: 1,
    borderColor: "#E5E3DA",
    borderRadius: 26,
    backgroundColor: "#FFFFFF",

    shadowColor: "#1F2B14",
    shadowOffset: {
      width: 0,
      height: 24,
    },
    shadowOpacity: 0.12,
    shadowRadius: 40,
  },

  previewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
  },

  previewCompany: {
    color: "#1A1915",
    fontSize: 20,
    fontWeight: "800",
  },

  previewUsdot: {
    marginTop: 4,
    color: "#706E68",
    fontSize: 12,
  },

  allClearBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#EAF3DE",
  },

  allClearText: {
    color: "#27500A",
    fontSize: 11,
    fontWeight: "800",
  },

  summaryRow: {
    marginTop: 24,
    marginBottom: 18,
    flexDirection: "row",
    gap: 10,
  },

  summaryBox: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#E5E3DA",
    borderRadius: 13,
    alignItems: "center",
  },

  summaryCount: {
    color: "#1A1915",
    fontSize: 25,
    fontWeight: "800",
  },

  summaryLabel: {
    marginTop: 3,
    color: "#706E68",
    fontSize: 11,
  },

  requirementList: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E3DA",
    borderRadius: 15,
  },

  requirementPreview: {
    minHeight: 68,
    paddingHorizontal: 15,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E3DA",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  requirementPreviewLast: {
    borderBottomWidth: 0,
  },

  requirementCopy: {
    flex: 1,
  },

  requirementTitle: {
    color: "#1A1915",
    fontSize: 14,
    fontWeight: "700",
  },

  requirementSubtitle: {
    marginTop: 4,
    color: "#706E68",
    fontSize: 11,
  },

  requirementBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: "#EAF3DE",
  },

  requirementBadgeText: {
    color: "#27500A",
    fontSize: 10,
    fontWeight: "800",
  },

  requirementBadgeWarning: {
    backgroundColor: "#FAEEDA",
  },

  requirementBadgeWarningText: {
    color: "#854F0B",
  },

  section: {
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingVertical: 100,
  },
  auditToolSection: {
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 34,
    gap: 16,
  },

  sectionTitle: {
    maxWidth: 760,
    color: "#1A1915",
    fontSize: 48,
    lineHeight: 51,
    fontWeight: "800",
    letterSpacing: -2,
  },

  featureGrid: {
    marginTop: 44,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 18,
  },

  featureCard: {
    flexGrow: 1,
    flexBasis: 260,
    minHeight: 250,
    padding: 26,
    borderWidth: 1,
    borderColor: "#E5E3DA",
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
  },

  featureNumber: {
    marginBottom: 48,
    color: "#3B6D11",
    fontSize: 12,
    fontWeight: "800",
  },

  featureTitle: {
    marginBottom: 10,
    color: "#1A1915",
    fontSize: 21,
    fontWeight: "800",
  },

  featureDescription: {
    color: "#5F5D57",
    fontSize: 15,
    lineHeight: 24,
  },


  referralSection: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E5E3DA",
    backgroundColor: "#FFFFFF",
  },

  referralInner: {
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingVertical: 100,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "stretch",
    gap: 56,
  },

  referralStory: {
  flexGrow: 1,
  flexShrink: 1,
  flexBasis: 420,
  justifyContent: "center",
},

  referralEyebrow: {
    marginBottom: 14,
    color: "#3B6D11",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
    letterSpacing: 1.2,
  },

  referralTitle: {
    maxWidth: 610,
    color: "#1A1915",
    fontSize: 46,
    lineHeight: 50,
    fontWeight: "800",
    letterSpacing: -1.8,
  },

  referralBody: {
    maxWidth: 610,
    marginTop: 22,
    color: "#5F5D57",
    fontSize: 18,
    lineHeight: 30,
  },

  referralCard: {
  flexGrow: 1,
  flexShrink: 1,
  flexBasis: 360,
  maxWidth: 470,
  padding: 34,
  borderRadius: 24,
  backgroundColor: "#1A1915",
},

  referralPercent: {
    color: "#B8D5A2",
    fontSize: 72,
    lineHeight: 78,
    fontWeight: "800",
    letterSpacing: -3,
  },

  referralCardLabel: {
    marginTop: 2,
    color: "#B8D5A2",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
  },

  referralCardTitle: {
    marginTop: 26,
    color: "#FFFFFF",
    fontSize: 29,
    lineHeight: 34,
    fontWeight: "800",
    letterSpacing: -0.8,
  },

  referralCardText: {
    marginTop: 18,
    color: "#E5E3DA",
    fontSize: 16,
    lineHeight: 26,
  },

  referralCardTextStrong: {
    marginTop: 20,
    color: "#FFFFFF",
    fontSize: 17,
    lineHeight: 25,
    fontWeight: "800",
  },

  referralFinePrint: {
    marginTop: 22,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: "#3C3A35",
    color: "#AAA79F",
    fontSize: 11,
    lineHeight: 18,
  },

  greenSection: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#D6E4C9",
    backgroundColor: "#EEF4E9",
  },

  greenSectionInner: {
  width: "100%",
  maxWidth: 1120,
  alignSelf: "center",
  paddingHorizontal: 24,
  paddingVertical: 100,
  flexDirection: "row",
  flexWrap: "wrap",
  alignItems: "flex-end",
  gap: 80,
},

  greenSectionHeading: {
  flexGrow: 1,
  flexShrink: 1,
  flexBasis: 420,
},

  greenSectionText: {
  flexGrow: 1,
  flexShrink: 1,
  flexBasis: 360,
  color: "#5F5D57",
  fontSize: 19,
  lineHeight: 32,
},

  positionLinks: { flexGrow: 1, flexBasis: "100%", flexDirection: "row", flexWrap: "wrap", gap: 10 },
  positionLinkButton: { minHeight: 44, paddingHorizontal: 15, borderWidth: 1, borderColor: "#B9D3A3", borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  positionLinkText: { color: "#27500A", fontSize: 13, fontWeight: "800" },

  finalSection: {
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingVertical: 90,
  },

  finalCard: {
  padding: 40,
  borderRadius: 24,
  backgroundColor: "#1A1915",
  flexDirection: "row",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 30,
},

  finalCopy: {
  flexGrow: 1,
  flexShrink: 1,
  flexBasis: 420,
},

  finalEyebrow: {
    marginBottom: 12,
    color: "#B8D5A2",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
  },

  finalTitle: {
    color: "#FFFFFF",
    fontSize: 40,
    lineHeight: 44,
    fontWeight: "800",
    letterSpacing: -1.5,
  },

  finalButton: {
    minHeight: 50,
    paddingHorizontal: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },

  finalButtonText: {
    color: "#27500A",
    fontSize: 14,
    fontWeight: "800",
  },

  footer: {
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 50,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: "#E5E3DA",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 30,
  },

  footerBrand: {
    color: "#1A1915",
    fontSize: 16,
    fontWeight: "800",
  },

  footerDescription: {
    marginTop: 8,
    color: "#706E68",
    fontSize: 13,
  },

  footerLinks: {
  flexDirection: "row",
  flexWrap: "wrap",
  gap: 20,
},

  footerLink: {
    color: "#706E68",
    fontSize: 13,
  },

  legal: {
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: "#E5E3DA",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 30,
  },

  legalText: {
    maxWidth: 650,
    color: "#8A8880",
    fontSize: 11,
    lineHeight: 17,
  },
});
