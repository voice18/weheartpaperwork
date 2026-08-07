import { Link } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function WebLandingPage() {
  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.pageContent}
    >
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <View style={styles.brandRow}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>WHP</Text>
            </View>

            <Text style={styles.brandName}>
              We Heart Paperwork
            </Text>
          </View>

          <View style={styles.headerLinks}>
            <Link href="/privacy" asChild>
              <Pressable>
                <Text style={styles.headerLink}>Privacy</Text>
              </Pressable>
            </Link>

            <Link href="/support" asChild>
              <Pressable>
                <Text style={styles.headerLink}>Support</Text>
              </Pressable>
            </Link>

            <Link href="/(auth)/login" asChild>
              <Pressable style={styles.loginButton}>
                <Text style={styles.loginButtonText}>
                  Sign in
                </Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>
            BUILT FOR SMALL TRUCKING COMPANIES
          </Text>

          <Text style={styles.heroTitle}>
            Keep your trucks moving.
          </Text>

          <Text style={styles.heroTitleAccent}>
            We’ll help with the paperwork.
          </Text>

          <Text style={styles.heroDescription}>
            Track company deadlines, driver records,
            renewals, and completion history from one clear
            dashboard.
          </Text>

          <View style={styles.heroButtons}>
            <Link href="/(auth)/login" asChild>
              <Pressable style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>
                  Sign in to your account
                </Text>
              </Pressable>
            </Link>

            <Pressable
              onPress={() => {
                if (typeof window !== "undefined") {
                  window.location.href =
                    "mailto:voice18@gmail.com?subject=We%20Heart%20Paperwork";
                }
              }}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>
                Contact us
              </Text>
            </Pressable>
          </View>

          <Text style={styles.availability}>
            Built for iPhone and Android.
          </Text>
        </View>

        <DashboardPreview />
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
            description="See company and driver deadlines before they become last-minute problems."
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

      <View style={styles.greenSection}>
        <View style={styles.greenSectionInner}>
          <View style={styles.greenSectionHeading}>
            <Text style={styles.eyebrow}>
              MADE FOR OWNER-OPERATORS AND SMALL FLEETS
            </Text>

            <Text style={styles.sectionTitle}>
              Paperwork should not be what stops the truck.
            </Text>
          </View>

          <Text style={styles.greenSectionText}>
            We Heart Paperwork is designed to reduce the
            administrative burden of staying organized so
            owners can spend more time operating their
            business.
          </Text>
        </View>
      </View>

      <View style={styles.finalSection}>
        <View style={styles.finalCard}>
          <View style={styles.finalCopy}>
            <Text style={styles.finalEyebrow}>
              WE HEART PAPERWORK
            </Text>

            <Text style={styles.finalTitle}>
              Stay organized. Stay ready. Keep moving.
            </Text>
          </View>

          <Pressable
            onPress={() => {
              if (typeof window !== "undefined") {
                window.location.href =
                  "mailto:voice18@gmail.com?subject=We%20Heart%20Paperwork";
              }
            }}
            style={styles.finalButton}
          >
            <Text style={styles.finalButtonText}>
              Contact us
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.footer}>
        <View>
          <Text style={styles.footerBrand}>
            We Heart Paperwork
          </Text>

          <Text style={styles.footerDescription}>
            Practical compliance organization for trucking
            companies.
          </Text>
        </View>

        <View style={styles.footerLinks}>
          <Link href="/privacy" asChild>
            <Pressable>
              <Text style={styles.footerLink}>Privacy</Text>
            </Pressable>
          </Link>

          <Link href="/support" asChild>
            <Pressable>
              <Text style={styles.footerLink}>Support</Text>
            </Pressable>
          </Link>
        </View>
      </View>

      <View style={styles.legal}>
        <Text style={styles.legalText}>
          © 2026 We Heart Paperwork
        </Text>

        <Text style={styles.legalText}>
          We Heart Paperwork helps organize compliance
          information and does not provide legal advice or
          guarantee regulatory compliance.
        </Text>
      </View>
    </ScrollView>
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
          title="Insurance renewal"
          subtitle="Company requirement"
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
    gap: 18,
  },

  featureCard: {
    flex: 1,
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
    alignItems: "flex-end",
    gap: 80,
  },

  greenSectionHeading: {
    flex: 1.1,
  },

  greenSectionText: {
    flex: 0.9,
    color: "#5F5D57",
    fontSize: 19,
    lineHeight: 32,
  },

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
    alignItems: "center",
    justifyContent: "space-between",
    gap: 30,
  },

  finalCopy: {
    flex: 1,
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