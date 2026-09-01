import { useState } from "react";
import { Link } from "expo-router";
import PublicHeader from "../components/public/PublicHeader";
import Head from "expo-router/head";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { usePublicCompact } from "../hooks/usePublicCompact";

export default function PricingPage() {
  const compact = usePublicCompact();

  const [driverCount, setDriverCount] = useState(1);

  const monthlyPrice = 2 + driverCount;

  return (
    <>
      <Head>
        <title>
          Pricing — $2/Month Plus $1 Per Driver | No Contracts
        </title>

        <meta
          name="description"
          content="Simple trucking compliance pricing: $2 per month plus $1 per active driver. One driver costs $3 a month. No contracts or setup fees."
        />

        <link
          rel="canonical"
          href="https://weheartpaperwork.com/pricing"
        />

        <meta
          property="og:title"
          content="Pricing — $2/Month Plus $1 Per Driver | No Contracts"
        />

        <meta
          property="og:description"
          content="Simple trucking compliance pricing: $2 per month plus $1 per active driver. One driver costs $3 a month. No contracts or setup fees."
        />

        <meta
          property="og:url"
          content="https://weheartpaperwork.com/pricing"
        />

        <meta
          property="og:type"
          content="website"
        />
      </Head>

      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.pageContent}
      >
        <PublicHeader />

        {/* Hero */}
        <View
          style={[
            styles.hero,
            compact && styles.heroCompact,
          ]}
        >
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>
              SIMPLE, STRAIGHTFORWARD PRICING
            </Text>

            <Text
              style={[
                styles.heroTitle,
                compact && styles.heroTitleCompact,
              ]}
            >
              Simple pricing.
            </Text>

            <Text
              style={[
                styles.heroTitleAccent,
                compact && styles.heroTitleCompact,
              ]}
            >
              Built to grow with you.
            </Text>

            <Text style={styles.heroDescription}>
              Start with a $2 monthly company subscription,
              then add $1 for each active driver. Whether
              you run one truck or a growing fleet, the math
              stays simple.
            </Text>

            <View style={styles.priceFormula}>
              <View style={styles.formulaItem}>
                <Text style={styles.formulaPrice}>$2</Text>
                <Text style={styles.formulaLabel}>
                  company
                </Text>
              </View>

              <Text style={styles.formulaPlus}>+</Text>

              <View style={styles.formulaItem}>
                <Text style={styles.formulaPrice}>$1</Text>
                <Text style={styles.formulaLabel}>
                  per active driver
                </Text>
              </View>
            </View>

            <Text style={styles.ownerOperatorCallout}>
              One active driver? That's $3 per month.
            </Text>
          </View>

          {/* Interactive estimator */}
          <View
            style={[
              styles.estimatorCard,
              compact && styles.estimatorCardCompact,
            ]}
          >
            <Text style={styles.estimatorEyebrow}>
              YOUR MONTHLY ESTIMATE
            </Text>

            <View style={styles.totalPriceRow}>
              <Text style={styles.dollarSign}>$</Text>

              <Text style={styles.totalPrice}>
                {monthlyPrice}
              </Text>

              <Text style={styles.perMonth}>
                / month
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.lineItem}>
              <View>
                <Text style={styles.lineItemTitle}>
                  Company subscription
                </Text>

                <Text style={styles.lineItemDescription}>
                  One company account
                </Text>
              </View>

              <Text style={styles.lineItemPrice}>
                $2
              </Text>
            </View>

            <View style={styles.lineItem}>
              <View style={styles.driverCopy}>
                <Text style={styles.lineItemTitle}>
                  Active drivers
                </Text>

                <Text style={styles.lineItemDescription}>
                  $1 per driver
                </Text>
              </View>

              <View style={styles.stepper}>
                <Pressable
                  accessibilityLabel="Remove one driver"
                  onPress={() =>
                    setDriverCount((current) =>
                      Math.max(0, current - 1)
                    )
                  }
                  style={styles.stepperButton}
                >
                  <Text style={styles.stepperButtonText}>
                    -
                  </Text>
                </Pressable>

                <Text style={styles.stepperCount}>
                  {driverCount}
                </Text>

                <Pressable
                  accessibilityLabel="Add one driver"
                  onPress={() =>
                    setDriverCount((current) =>
                      Math.min(100, current + 1)
                    )
                  }
                  style={styles.stepperButton}
                >
                  <Text style={styles.stepperButtonText}>
                    +
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.totalDivider} />

            <View style={styles.lineItem}>
              <Text style={styles.totalLabel}>
                Estimated monthly total
              </Text>

              <Text style={styles.totalLinePrice}>
                ${monthlyPrice}
              </Text>
            </View>

            <Link href={{ pathname: "/(auth)/login", params: { mode: "create" } }} asChild>
              <Pressable style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>
                  Create account
                </Text>
              </Pressable>
            </Link>

            <Text style={styles.estimatorNote}>
              Pricing is based on the number of active drivers
              in your company.
            </Text>
            <View
              style={{
                marginTop: 18,
                paddingTop: 18,
                borderTopWidth: 1,
                borderTopColor: "#E5E3DA",
              }}
            >
              <Text
                style={{
                  color: "#1A1915",
                  fontSize: 16,
                  fontWeight: "800",
                  marginBottom: 6,
                }}
              >
                14-day free trial
              </Text>

              <Text
                style={{
                  color: "#706E68",
                  fontSize: 14,
                  lineHeight: 22,
                }}
              >
                Try We Heart Paperwork free for 14 days. After the trial,
                your subscription is $2 per month plus $1 per active driver.
              </Text>
            </View>
          </View>
        </View>

        {/* What's included */}
        <View style={styles.section}>
          <Text style={styles.eyebrow}>
            ONE SUBSCRIPTION. THE IMPORTANT STUFF.
          </Text>

          <Text
            style={[
              styles.sectionTitle,
              compact && styles.sectionTitleCompact,
            ]}
          >
            Built to keep the paperwork from becoming the job.
          </Text>

          <Text style={styles.sectionDescription}>
            We Heart Paperwork gives trucking companies one
            clear place to keep recurring company, driver, and
            fleet compliance work organized.
          </Text>

          <View
            style={[
              styles.featureGrid,
              compact && styles.featureGridCompact,
            ]}
          >
            <FeatureCard
              number="01"
              title="Company deadlines"
              description="Keep important company compliance dates visible instead of relying on memory, calendars, and scattered notes."
            />

            <FeatureCard
              number="02"
              title="Driver renewals"
              description="Track driver-specific dates like medical cards, annual MVRs, CDL information, and recurring requirements."
            />

            <FeatureCard
              number="03"
              title="Fleet deadlines"
              description="Keep truck and trailer registrations and annual DOT inspections visible, with reminders and renewal history for each vehicle."
            />

            <FeatureCard
              number="04"
              title="Completion history"
              description="Keep a practical record of what was completed, when it was completed, and what comes next."
            />
          </View>
        </View>

        {/* Included section */}
        <View style={styles.greenSection}>
          <View style={styles.greenSectionInner}>
            <Text style={styles.eyebrow}>
              INCLUDED
            </Text>

            <Text
              style={[
                styles.sectionTitle,
                compact && styles.sectionTitleCompact,
              ]}
            >
              Simple tools for staying ahead.
            </Text>

            <View
              style={[
                styles.includedGrid,
                compact && styles.includedGridCompact,
              ]}
            >
              <View style={styles.includedColumn}>
                <IncludedItem text="Company compliance tracking" />
                <IncludedItem text="Driver deadline tracking" />
                <IncludedItem text="Truck and trailer tracking" />
              </View>

              <View style={styles.includedColumn}>
                <IncludedItem text="Deadline reminders" />
                <IncludedItem text="Completion history" />
                <IncludedItem text="iPhone and Android access" />
              </View>
            </View>
          </View>
        </View>

        {/* Examples */}
        <View style={styles.section}>
          <Text style={styles.eyebrow}>
            WHAT DOES IT COST FOR MY COMPANY?
          </Text>

          <Text
            style={[
              styles.sectionTitle,
              compact && styles.sectionTitleCompact,
            ]}
          >
            The math stays simple as you grow.
          </Text>

          <View style={styles.exampleTable}>
            <PriceExample
              drivers="0 active drivers"
              description="Company account only"
              price="$2/mo"
            />

            <PriceExample
              drivers="1 active driver"
              description="Typical owner-operator"
              price="$3/mo"
            />

            <PriceExample
              drivers="2 active drivers"
              description="Small operation"
              price="$4/mo"
            />

            <PriceExample
              drivers="5 active drivers"
              description="Growing small fleet"
              price="$7/mo"
            />

            <PriceExample
              drivers="10 active drivers"
              description="10-driver fleet"
              price="$12/mo"
              last
            />
          </View>
        </View>

        {/* Philosophy */}
        <View style={styles.philosophySection}>
          <View
            style={[
              styles.philosophyInner,
              compact && styles.philosophyInnerCompact,
            ]}
          >
            <View style={styles.philosophyHeading}>
              <Text style={styles.eyebrow}>
                BUILT FOR TRUCKING COMPANIES
              </Text>

              <Text
                style={[
                  styles.sectionTitle,
                  compact && styles.sectionTitleCompact,
                ]}
              >
                You shouldn't need enterprise software to
                remember a deadline.
              </Text>
            </View>

            <View style={styles.philosophyCopy}>
              <Text style={styles.philosophyText}>
                We Heart Paperwork is intentionally simple.
                It gives trucking companies a clear view of
                their paperwork without adding another
                complicated system to manage.
              </Text>

              <Text style={styles.philosophyText}>
                The goal is not to turn compliance into a
                bigger job. The goal is to help you see what
                needs attention and keep moving.
              </Text>
            </View>
          </View>
        </View>

        {/* FAQ */}
        <View style={styles.section}>
          <Text style={styles.eyebrow}>
            PRICING QUESTIONS
          </Text>

          <Text
            style={[
              styles.sectionTitle,
              compact && styles.sectionTitleCompact,
            ]}
          >
            Straight answers.
          </Text>

          <View style={styles.faqList}>
            <FaqItem
              question="How much does an owner-operator pay?"
              answer="A company with one active driver is $3 per month: $2 for the company subscription plus $1 for the active driver."
            />

            <FaqItem
              question="What counts toward the driver price?"
              answer="Pricing is based on active drivers. The company subscription remains $2 per month, with $1 added for each active driver."
            />

            <FaqItem
              question="Does We Heart Paperwork file forms for me?"
              answer="No—and that is intentional. You handle the filings and compliance decisions; We Heart Paperwork gives you one organized system for deadlines, reminders, setup records, and completion history."
            />

            <FaqItem
              question="Is there a free trial?"
              answer="Yes. Every new subscription starts with a 14-day free trial before monthly billing begins."
            />

            <FaqItem
              question="Does the app guarantee regulatory compliance?"
              answer="No. We Heart Paperwork helps organize compliance information and reminders. It does not provide legal advice or guarantee compliance."
              last
            />
          </View>
        </View>

        {/* Final CTA */}
        <View style={styles.finalSection}>
          <View
            style={[
              styles.finalCard,
              compact && styles.finalCardCompact,
            ]}
          >
            <View style={styles.finalCopy}>
              <Text style={styles.finalEyebrow}>
                WE HEART PAPERWORK
              </Text>

              <Text
                style={[
                  styles.finalTitle,
                  compact && styles.finalTitleCompact,
                ]}
              >
                Less scrambling. More trucking.
              </Text>

              <Text style={styles.finalDescription}>
                Start with the company you have today.
              </Text>
            </View>

            <Link href={{ pathname: "/(auth)/login", params: { mode: "create" } }} asChild>
              <Pressable style={styles.finalButton}>
                <Text style={styles.finalButtonText}>
                  Create account
                </Text>
              </Pressable>
            </Link>
          </View>
        </View>

        {/* Footer */}
        <View
          style={[
            styles.footer,
            compact && styles.footerCompact,
          ]}
        >
          <View>
            <Text style={styles.footerBrand}>
              We Heart Paperwork
            </Text>

            <Text style={styles.footerDescription}>
              Practical compliance organization for trucking
              companies.
            </Text>
          </View>

          <View
            style={[
              styles.footerLinks,
              compact && styles.footerLinksCompact,
            ]}
          >
            <Link href="/" asChild>
              <Pressable>
                <Text style={styles.footerLink}>Home</Text>
              </Pressable>
            </Link>

            <Text
              style={[
                styles.footerLink,
                styles.footerLinkActive,
              ]}
            >
              Pricing
            </Text>

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

        <View
          style={[
            styles.legal,
            compact && styles.legalCompact,
          ]}
        >
          <Text style={styles.legalText}>
            {"\u00A9"} 2026 We Heart Paperwork
          </Text>

          <Text style={styles.legalText}>
            We Heart Paperwork helps organize compliance
            information and does not provide legal advice or
            guarantee regulatory compliance.
          </Text>
        </View>
      </ScrollView>
    </>
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

      <Text style={styles.featureTitle}>
        {title}
      </Text>

      <Text style={styles.featureDescription}>
        {description}
      </Text>
    </View>
  );
}

function IncludedItem({
  text,
}: {
  text: string;
}) {
  return (
    <View style={styles.includedItem}>
      <View style={styles.checkCircle}>
        <Text style={styles.checkText}>✓</Text>
      </View>

      <Text style={styles.includedText}>
        {text}
      </Text>
    </View>
  );
}

function PriceExample({
  drivers,
  description,
  price,
  last = false,
}: {
  drivers: string;
  description: string;
  price: string;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.exampleRow,
        last && styles.exampleRowLast,
      ]}
    >
      <View style={styles.exampleCopy}>
        <Text style={styles.exampleDrivers}>
          {drivers}
        </Text>

        <Text style={styles.exampleDescription}>
          {description}
        </Text>
      </View>

      <Text style={styles.examplePrice}>
        {price}
      </Text>
    </View>
  );
}

function FaqItem({
  question,
  answer,
  last = false,
}: {
  question: string;
  answer: string;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.faqItem,
        last && styles.faqItemLast,
      ]}
    >
      <Text style={styles.faqQuestion}>
        {question}
      </Text>

      <Text style={styles.faqAnswer}>
        {answer}
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

  headerInnerCompact: {
    minHeight: 68,
    paddingHorizontal: 18,
    gap: 12,
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

  headerLinksCompact: {
    gap: 12,
  },

  headerLink: {
    color: "#706E68",
    fontSize: 14,
    fontWeight: "500",
  },

  headerLinkActive: {
    color: "#27500A",
    fontWeight: "800",
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

  heroCompact: {
    paddingHorizontal: 18,
    paddingTop: 56,
    paddingBottom: 64,
    flexDirection: "column",
    alignItems: "stretch",
    gap: 42,
  },

  heroCopy: {
    flex: 1.05,
    minWidth: 280,
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
    fontSize: 56,
    lineHeight: 59,
    fontWeight: "800",
    letterSpacing: -2.6,
  },

  heroTitleAccent: {
    color: "#3B6D11",
    fontSize: 56,
    lineHeight: 59,
    fontWeight: "800",
    letterSpacing: -2.6,
  },

  heroTitleCompact: {
    fontSize: 40,
    lineHeight: 43,
    letterSpacing: -1.6,
  },

  heroDescription: {
    maxWidth: 590,
    marginTop: 26,
    color: "#5F5D57",
    fontSize: 19,
    lineHeight: 30,
  },

  priceFormula: {
    marginTop: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },

  formulaItem: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 7,
  },

  formulaPrice: {
    color: "#1A1915",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.8,
  },

  formulaLabel: {
    color: "#706E68",
    fontSize: 14,
    fontWeight: "600",
  },

  formulaPlus: {
    color: "#A3A098",
    fontSize: 22,
    fontWeight: "500",
  },

  ownerOperatorCallout: {
    marginTop: 17,
    color: "#27500A",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
  },

  estimatorCard: {
    flex: 0.95,
    minWidth: 330,
    maxWidth: 460,
    padding: 28,
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

  estimatorCardCompact: {
    width: "100%",
    minWidth: 0,
    maxWidth: 560,
    alignSelf: "center",
  },

  estimatorEyebrow: {
    color: "#706E68",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
  },

  totalPriceRow: {
    marginTop: 11,
    flexDirection: "row",
    alignItems: "baseline",
  },

  dollarSign: {
    color: "#1A1915",
    fontSize: 26,
    fontWeight: "800",
  },

  totalPrice: {
    color: "#1A1915",
    fontSize: 58,
    lineHeight: 64,
    fontWeight: "800",
    letterSpacing: -2,
  },

  perMonth: {
    marginLeft: 7,
    color: "#706E68",
    fontSize: 15,
    fontWeight: "600",
  },

  divider: {
    height: 1,
    marginVertical: 22,
    backgroundColor: "#E5E3DA",
  },

  lineItem: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
  },

  driverCopy: {
    flex: 1,
  },

  lineItemTitle: {
    color: "#1A1915",
    fontSize: 14,
    fontWeight: "700",
  },

  lineItemDescription: {
    marginTop: 4,
    color: "#706E68",
    fontSize: 12,
  },

  lineItemPrice: {
    color: "#1A1915",
    fontSize: 16,
    fontWeight: "800",
  },

  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  stepperButton: {
    width: 34,
    height: 34,
    borderWidth: 1,
    borderColor: "#D3D1C7",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FAFAF8",
  },

  stepperButtonText: {
    color: "#27500A",
    fontSize: 18,
    lineHeight: 20,
    fontWeight: "800",
  },

  stepperCount: {
    minWidth: 24,
    textAlign: "center",
    color: "#1A1915",
    fontSize: 16,
    fontWeight: "800",
  },

  totalDivider: {
    height: 1,
    marginTop: 16,
    marginBottom: 12,
    backgroundColor: "#D6E4C9",
  },

  totalLabel: {
    color: "#27500A",
    fontSize: 14,
    fontWeight: "800",
  },

  totalLinePrice: {
    color: "#27500A",
    fontSize: 20,
    fontWeight: "800",
  },

  primaryButton: {
    minHeight: 52,
    marginTop: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#27500A",
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  estimatorNote: {
    marginTop: 13,
    color: "#8A8880",
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
  },

  section: {
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingVertical: 100,
  },

  sectionTitle: {
    maxWidth: 820,
    color: "#1A1915",
    fontSize: 46,
    lineHeight: 50,
    fontWeight: "800",
    letterSpacing: -1.9,
  },

  sectionTitleCompact: {
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -1.1,
  },

  sectionDescription: {
    maxWidth: 700,
    marginTop: 22,
    color: "#5F5D57",
    fontSize: 18,
    lineHeight: 29,
  },

  featureGrid: {
    marginTop: 44,
    flexDirection: "row",
    gap: 18,
  },

  featureGridCompact: {
    flexDirection: "column",
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
  },

  includedGrid: {
    marginTop: 42,
    flexDirection: "row",
    gap: 60,
  },

  includedGridCompact: {
    flexDirection: "column",
    gap: 0,
  },

  includedColumn: {
    flex: 1,
  },

  includedItem: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#D6E4C9",
  },

  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#27500A",
  },

  checkText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },

  includedText: {
    flex: 1,
    color: "#1A1915",
    fontSize: 15,
    fontWeight: "600",
  },

  exampleTable: {
    marginTop: 44,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E3DA",
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
  },

  exampleRow: {
    minHeight: 84,
    paddingHorizontal: 24,
    paddingVertical: 17,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E3DA",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
  },

  exampleRowLast: {
    borderBottomWidth: 0,
  },

  exampleCopy: {
    flex: 1,
  },

  exampleDrivers: {
    color: "#1A1915",
    fontSize: 15,
    fontWeight: "800",
  },

  exampleDescription: {
    marginTop: 4,
    color: "#706E68",
    fontSize: 12,
  },

  examplePrice: {
    color: "#27500A",
    fontSize: 20,
    fontWeight: "800",
  },

  philosophySection: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E5E3DA",
    backgroundColor: "#F4F3EE",
  },

  philosophyInner: {
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingVertical: 100,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 80,
  },

  philosophyInnerCompact: {
    flexDirection: "column",
    gap: 32,
  },

  philosophyHeading: {
    flex: 1.15,
  },

  philosophyCopy: {
    flex: 0.85,
    gap: 20,
  },

  philosophyText: {
    color: "#5F5D57",
    fontSize: 17,
    lineHeight: 29,
  },

  faqList: {
    marginTop: 44,
    borderTopWidth: 1,
    borderTopColor: "#E5E3DA",
  },

  faqItem: {
    paddingVertical: 28,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E3DA",
  },

  faqItemLast: {
    borderBottomWidth: 0,
  },

  faqQuestion: {
    color: "#1A1915",
    fontSize: 18,
    fontWeight: "800",
  },

  faqAnswer: {
    maxWidth: 780,
    marginTop: 10,
    color: "#5F5D57",
    fontSize: 15,
    lineHeight: 25,
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

  finalCardCompact: {
    padding: 30,
    flexDirection: "column",
    alignItems: "flex-start",
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
    fontSize: 38,
    lineHeight: 42,
    fontWeight: "800",
    letterSpacing: -1.4,
  },

  finalTitleCompact: {
    fontSize: 30,
    lineHeight: 34,
  },

  finalDescription: {
    marginTop: 10,
    color: "#D5D3CC",
    fontSize: 14,
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

  footerCompact: {
    flexDirection: "column",
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

  footerLinksCompact: {
    flexWrap: "wrap",
  },

  footerLink: {
    color: "#706E68",
    fontSize: 13,
  },

  footerLinkActive: {
    color: "#27500A",
    fontWeight: "800",
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

  legalCompact: {
    flexDirection: "column",
    gap: 10,
  },

  legalText: {
    maxWidth: 650,
    color: "#8A8880",
    fontSize: 11,
    lineHeight: 17,
  },
});
