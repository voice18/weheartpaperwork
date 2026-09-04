import { Link } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";

const COMPANY_MONTHLY_CENTS = 200;
const DRIVER_MONTHLY_CENTS = 100;
const REFERRAL_RATE = 0.1;

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function safeWholeNumber(value: string, fallback: number) {
  const cleaned = value.replace(/[^0-9]/g, "");
  if (!cleaned) return fallback;
  return Math.max(0, Math.min(10000, Number(cleaned)));
}

export default function ReferralRewardsPage() {
  const { width } = useWindowDimensions();
  const compact = width < 820;
  const veryCompact = width < 560;

  const [companyCountText, setCompanyCountText] = useState("10");
  const [driverCountText, setDriverCountText] = useState("1");

  const companyCount = safeWholeNumber(companyCountText, 0);
  const averageDrivers = safeWholeNumber(driverCountText, 0);
  const averageSubscriptionCents =
    COMPANY_MONTHLY_CENTS + averageDrivers * DRIVER_MONTHLY_CENTS;
  const monthlyRewardCents = Math.round(
    companyCount * averageSubscriptionCents * REFERRAL_RATE
  );
  const annualRewardCents = monthlyRewardCents * 12;

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.pageContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View
          style={[
            styles.headerInner,
            compact && styles.headerInnerCompact,
          ]}
        >
          <Link href="/" asChild>
            <Pressable style={styles.brandRow}>
              <View style={styles.logo}>
                <Text style={styles.logoText}>WHP</Text>
              </View>
              <Text style={styles.brandName}>We Heart Paperwork</Text>
            </Pressable>
          </Link>

          <View
            style={[
              styles.headerLinks,
              compact && styles.headerLinksCompact,
            ]}
          >
            {!veryCompact ? (
              <Link href="/features" asChild>
                <Pressable>
                  <Text style={styles.headerLink}>Features</Text>
                </Pressable>
              </Link>
            ) : null}

            <Link href="/pricing" asChild>
              <Pressable>
                <Text style={styles.headerLink}>Pricing</Text>
              </Pressable>
            </Link>

            {!compact ? (
              <Link href="/compliance" asChild>
                <Pressable>
                  <Text style={styles.headerLink}>Guides</Text>
                </Pressable>
              </Link>
            ) : null}

            <View style={styles.authActions}>
              <Link href="/(auth)/login" asChild>
                <Pressable style={styles.signInButton}>
                  <Text style={styles.signInButtonText}>Sign in</Text>
                </Pressable>
              </Link>
              <Link href={{ pathname: "/(auth)/login", params: { mode: "create" } }} asChild>
                <Pressable style={styles.createAccountButton}>
                  <Text style={styles.createAccountButtonText}>Create account</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </View>
      </View>

      <View style={[styles.hero, compact && styles.heroCompact]}>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>REFERRAL REWARDS</Text>
          <Text style={[styles.heroTitle, compact && styles.heroTitleCompact]}>
            Help us grow. Earn 10%.
          </Text>
          <Text style={styles.heroDescription}>
            We Heart Paperwork was built for a trucking company first.
            When our customers help us bring another carrier on board,
            we think that contribution should have real value.
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

        <View style={styles.heroCard}>
          <Text style={styles.heroPercent}>10%</Text>
          <Text style={styles.heroCardLabel}>DIRECT REFERRAL REWARD</Text>
          <Text style={styles.heroCardTitle}>One level. Direct referrals only.</Text>
          <Text style={styles.heroCardText}>
            You earn Referral Rewards only from trucking companies you
            personally refer to We Heart Paperwork.
          </Text>
          <Text style={styles.heroCardStrong}>
            No downlines. No second-level commissions. No recruiting bonuses.
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.eyebrow}>HOW IT WORKS</Text>
        <Text style={[styles.sectionTitle, compact && styles.sectionTitleCompact]}>
          A simple referral. A permanent record.
        </Text>

        <View style={[styles.stepsGrid, compact && styles.stack]}>
          <StepCard
            number="01"
            title="Get your code"
              description="Eligible We Heart Paperwork accounts can accept the current terms and create one referral code tied to their company."
          />
          <StepCard
            number="02"
            title="Refer a carrier"
            description="Share your code with another trucking company that is not already a We Heart Paperwork customer."
          />
          <StepCard
            number="03"
            title="They sign up"
              description="The new company claims your valid code within 24 hours after account creation, before its first qualifying payment."
          />
          <StepCard
            number="04"
            title="We track 10%"
            description="The referral record connects your company, the referred company, and the applicable 10% referral rate."
          />
        </View>
      </View>

      <View style={styles.directSection}>
        <View
          style={[
            styles.directInner,
            compact && styles.directInnerCompact,
          ]}
        >
          <View style={styles.directCopy}>
            <Text style={styles.eyebrow}>ONE LEVEL MEANS ONE LEVEL</Text>
            <Text style={[styles.sectionTitle, compact && styles.sectionTitleCompact]}>
              Your referrals are yours. Their referrals are theirs.
            </Text>
            <Text style={styles.bodyText}>
              If you refer Carrier A, you can earn the applicable reward from
              Carrier A's qualifying subscription payments. If Carrier A later
              refers Carrier B, Carrier B belongs to Carrier A's referral record.
              You do not earn anything from Carrier B.
            </Text>
          </View>

          <View style={styles.flowCard}>
            <View style={styles.flowNodePrimary}>
              <Text style={styles.flowNodePrimaryText}>YOU</Text>
            </View>
            <Text style={styles.flowArrow}>↓</Text>
            <View style={styles.flowNode}>
              <Text style={styles.flowNodeTitle}>Carrier A</Text>
              <Text style={styles.flowNodeMeta}>Your direct referral · you earn 10%</Text>
            </View>
            <Text style={styles.flowArrow}>↓</Text>
            <View style={styles.flowNodeMuted}>
              <Text style={styles.flowNodeTitle}>Carrier B</Text>
              <Text style={styles.flowNodeMeta}>Referred by Carrier A · you earn $0</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.eyebrow}>SEE THE MATH</Text>
        <Text style={[styles.sectionTitle, compact && styles.sectionTitleCompact]}>
          What could your direct referrals generate?
        </Text>
        <Text style={styles.sectionLead}>
          This calculator only applies the current We Heart Paperwork pricing
          formula and the 10% direct-referral rate. It is an illustration, not a
          promise of earnings.
        </Text>

        <View
          style={[
            styles.calculator,
            compact && styles.calculatorCompact,
          ]}
        >
          <View style={styles.calculatorInputs}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Direct companies referred</Text>
              <TextInput
                value={companyCountText}
                onChangeText={(text) =>
                  setCompanyCountText(text.replace(/[^0-9]/g, ""))
                }
                keyboardType="number-pad"
                inputMode="numeric"
                style={styles.input}
                accessibilityLabel="Direct companies referred"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Average active drivers per company</Text>
              <TextInput
                value={driverCountText}
                onChangeText={(text) =>
                  setDriverCountText(text.replace(/[^0-9]/g, ""))
                }
                keyboardType="number-pad"
                inputMode="numeric"
                style={styles.input}
                accessibilityLabel="Average active drivers per referred company"
              />
            </View>

            <View style={styles.mathExplanation}>
              <Text style={styles.mathLine}>
                Average subscription: {money(averageSubscriptionCents)}/month
              </Text>
              <Text style={styles.mathSmall}>
                $2 company fee + $1 per active driver at current pricing.
              </Text>
            </View>
          </View>

          <View style={styles.resultCard}>
            <Text style={styles.resultEyebrow}>ILLUSTRATIVE REFERRAL REWARD</Text>
            <Text style={styles.resultAmount}>{money(monthlyRewardCents)}</Text>
            <Text style={styles.resultPeriod}>per month</Text>
            <Text style={styles.resultAnnual}>{money(annualRewardCents)} per year</Text>
            <Text style={styles.resultNote}>
              Based on {companyCount} direct qualifying referral{companyCount === 1 ? "" : "s"}
              {" "}averaging {averageDrivers} active driver{averageDrivers === 1 ? "" : "s"} each.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.whySection}>
        <View style={styles.whyInner}>
          <Text style={styles.eyebrow}>WHY WE BUILT IT THIS WAY</Text>
          <Text style={[styles.sectionTitle, compact && styles.sectionTitleCompact]}>
            Built by trucking. Grown by trucking.
          </Text>
          <Text style={styles.whyText}>
            Traditional software companies spend money acquiring customers.
            We would rather put part of that value in the hands of the trucking
            companies that actually help We Heart Paperwork grow. You are not
            buying ownership. You are doing something useful for the company —
            introducing a new customer — and we record a referral reward for it.
          </Text>
        </View>
      </View>

      <View style={styles.rulesSection}>
        <View style={styles.rulesInner}>
          <Text style={styles.eyebrow}>PROGRAM TERMS</Text>
          <Text style={[styles.sectionTitle, compact && styles.sectionTitleCompact]}>
            Referral Rewards Program — Rules & Conditions
          </Text>
          <Text style={styles.effective}>Updated September 4, 2026. Changes apply prospectively.</Text>

          <View style={styles.rulesCard}>
            <Rule
              title="1. Direct referrals only"
              text="Referral Rewards are limited to first-level, direct referrals. You do not earn rewards, commissions, or other compensation from customers referred by another participant, including customers referred by a company you previously referred. We Heart Paperwork does not maintain a downline or multi-tier referral compensation structure."
            />
            <Rule
              title="2. Qualifying referral"
              text="A qualifying referral must be a new We Heart Paperwork company account that claims a valid referral code within 24 hours after account creation, before its qualifying payment. Both companies must provide their USDOT numbers. One company identity cannot receive a second attribution through another login. Company ownership and eligibility are subject to verification."
            />
            <Rule
              title="3. One company, one referrer"
              text="Each referred company may be attributed to only one referring company. Once valid referral attribution has been established, it may not be transferred between referral codes except to correct a documented system or administrative error."
            />
            <Rule
              title="4. No self-referrals"
              text="A company may not refer itself, create duplicate accounts for referral credit, or use another controlled account to circumvent this rule."
            />
            <Rule
              title="5. Referral rate"
              text="Unless We Heart Paperwork publishes a different rate before a referral is established, that referral's rate is fixed at 10% of qualifying subscription fees actually received and retained by We Heart Paperwork from the directly referred company. Rewards are calculated in whole cents and rounded down when necessary."
            />
            <Rule
              title="6. Qualifying subscription fees"
              text="Qualifying fees are USD payments actually collected through Stripe for approved base-company and active-driver subscriptions, after discounts and taxes. Trial/free periods, customer credits, manually marked-paid invoices, unrelated purchases and fraudulent payments do not qualify. Driver changes affect the actual invoice, never an earlier reward. Refunds, post-payment credits and lost chargebacks reduce qualifying revenue. Payment-level reductions are allocated proportionately to qualifying fees, and the remaining reward is rounded down to whole cents. Open disputes hold the invoice reward for review. Mixed or unsupported payment arrangements require reconciliation before any reward is available."
            />
            <Rule
              title="7. No recruiting compensation"
              text="Referral Rewards compensate qualifying customer referrals. You are not paid merely for recruiting another participant into the Referral Rewards Program, and you receive no compensation from referrals made by companies you referred."
            />
            <Rule
              title="8. Continued eligibility"
              text="Attribution stays on record. A qualifying payment requires the referring account to be open, in good standing and subscribed (including an eligible trial), and the referred company to generate a qualifying subscription payment. Cancellation itself creates no reward or reversal; earned rewards remain subject to payment adjustments. Payments after participation ends do not qualify. Reactivation can resume eligibility under the original attribution and locked rate. If payment-time eligibility cannot be established automatically, the reward is held for documented review."
            />
            <Rule
              title="9. Tracking and payout administration"
              text="A qualifying reward has a 30-day hold measured from the invoice payment time. After maturity processing and resolution of any review holds, it becomes available. Once payout processing is activated, administrators can reserve available USD balances of at least $25 after offsets, verify company ownership and payment/tax information, and issue a manual transfer. Smaller balances roll forward. There is no automatic monthly transfer or guaranteed payment date. Reserved funds cannot be included in another payout. The ledger records transfer confirmation; preparing a payout does not itself send money. Activation status and balances are shown in account settings."
            />
            <Rule
              title="10. Refunds, disputes, fraud, and errors"
              text="Refunded, credited, disputed, fraudulent, duplicate, erroneous or otherwise invalid payments can reduce rewards. Adjustments remain in the accounting history. A reversal after a payout leaves an overpayment balance that offsets future available earnings; the past transfer remains recorded. A won dispute can restore the qualifying reward after other holds are resolved. Attempts to manipulate the program may result in removal from Referral Rewards."
            />
            <Rule
              title="11. Marketing disclosure"
              text="If you publicly recommend or endorse We Heart Paperwork using your referral code or link, clearly disclose that you may receive a referral reward if someone signs up through your referral."
            />
            <Rule
              title="12. No ownership or investment interest"
              text="Referral Rewards are compensation for qualifying customer referrals. They are not stock, equity, ownership, dividends, securities, voting rights, or an investment in We Heart Paperwork. Participation does not create an ownership interest in the company."
            />
            <Rule
              title="13. Taxes and payment information"
              text="Participants are responsible for providing accurate payment and tax information when required and for taxes that may apply to Referral Rewards they receive."
            />
            <Rule
              title="14. Program changes"
              text="We Heart Paperwork may modify or discontinue the program prospectively. A prospective change will not retroactively erase a valid reward already earned from a qualifying payment, except where correction is required because of a refund, chargeback, fraud, error, or violation of these terms."
            />
            <Rule
              title="15. Account deletion and record retention"
              text="Deleting a referring account deactivates its referral code and ends future participation. Referral codes are not reused. Deleting either account does not erase attribution, reward, adjustment, payout, fraud-prevention, tax, or audit records that We Heart Paperwork must retain for legitimate business or legal purposes. Nonessential personal information may be removed or minimized separately."
              last
            />
          </View>

          <Text style={styles.rulesNote}>
            These rules describe the We Heart Paperwork Referral Rewards Program.
            They do not provide legal or tax advice. Program administration may
            require additional identity, payment, or tax verification before funds
            can be issued.
          </Text>
        </View>
      </View>

      <View style={styles.finalSection}>
        <View style={[styles.finalCard, compact && styles.finalCardCompact]}>
          <View style={styles.finalCopy}>
            <Text style={styles.finalEyebrow}>WE HEART PAPERWORK</Text>
            <Text style={styles.finalTitle}>You helped us grow. That should matter.</Text>
          </View>

          <Link href="/pricing" asChild>
            <Pressable style={styles.finalButton}>
              <Text style={styles.finalButtonText}>See pricing</Text>
            </Pressable>
          </Link>
        </View>
      </View>

      <View style={[styles.footer, compact && styles.footerCompact]}>
        <View>
          <Text style={styles.footerBrand}>We Heart Paperwork</Text>
          <Text style={styles.footerDescription}>
            Built by a trucking company for trucking companies.
          </Text>
        </View>

        <View style={[styles.footerLinks, compact && styles.footerLinksCompact]}>
          <Link href="/" asChild>
            <Pressable><Text style={styles.footerLink}>Home</Text></Pressable>
          </Link>
          <Link href="/features" asChild>
            <Pressable><Text style={styles.footerLink}>Features</Text></Pressable>
          </Link>
          <Link href="/pricing" asChild>
            <Pressable><Text style={styles.footerLink}>Pricing</Text></Pressable>
          </Link>
          <Link href="/about" asChild>
            <Pressable><Text style={styles.footerLink}>About</Text></Pressable>
          </Link>
          <Link href="/support" asChild>
            <Pressable><Text style={styles.footerLink}>Support</Text></Pressable>
          </Link>
        </View>
      </View>

      <View style={[styles.legal, compact && styles.legalCompact]}>
        <Text style={styles.legalText}>{"\u00A9"} 2026 We Heart Paperwork</Text>
        <Text style={styles.legalText}>
          Referral Rewards are compensation for qualifying customer referrals and do not represent ownership in We Heart Paperwork.
        </Text>
      </View>
    </ScrollView>
  );
}

function StepCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <View style={styles.stepCard}>
      <Text style={styles.stepNumber}>{number}</Text>
      <Text style={styles.stepTitle}>{title}</Text>
      <Text style={styles.stepDescription}>{description}</Text>
    </View>
  );
}

function Rule({
  title,
  text,
  last = false,
}: {
  title: string;
  text: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.rule, last && styles.ruleLast]}>
      <Text style={styles.ruleTitle}>{title}</Text>
      <Text style={styles.ruleText}>{text}</Text>
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
    minHeight: 66,
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
  authActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  signInButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#B8C6AA",
    backgroundColor: "#FAFAF8",
  },
  signInButtonText: {
    color: "#27500A",
    fontSize: 14,
    fontWeight: "700",
  },
  createAccountButton: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#27500A",
  },
  createAccountButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  hero: {
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingVertical: 92,
    flexDirection: "row",
    alignItems: "center",
    gap: 64,
  },
  heroCompact: {
    paddingVertical: 58,
    flexDirection: "column",
    alignItems: "stretch",
    gap: 34,
  },
  heroCopy: {
    flex: 1.08,
    minWidth: 0,
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
    maxWidth: 640,
    color: "#1A1915",
    fontSize: 60,
    lineHeight: 62,
    fontWeight: "800",
    letterSpacing: -2.8,
  },
  heroTitleCompact: {
    fontSize: 44,
    lineHeight: 47,
    letterSpacing: -1.8,
  },
  heroDescription: {
    maxWidth: 620,
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
  heroCard: {
    flex: 0.92,
    maxWidth: 460,
    padding: 34,
    borderRadius: 24,
    backgroundColor: "#1A1915",
  },
  heroPercent: {
    color: "#B8D5A2",
    fontSize: 76,
    lineHeight: 80,
    fontWeight: "800",
    letterSpacing: -3,
  },
  heroCardLabel: {
    marginTop: 4,
    color: "#B8D5A2",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  heroCardTitle: {
    marginTop: 28,
    color: "#FFFFFF",
    fontSize: 30,
    lineHeight: 35,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  heroCardText: {
    marginTop: 18,
    color: "#E5E3DA",
    fontSize: 16,
    lineHeight: 26,
  },
  heroCardStrong: {
    marginTop: 18,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: "#3C3A35",
    color: "#FFFFFF",
    fontSize: 15,
    lineHeight: 24,
    fontWeight: "800",
  },
  section: {
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingVertical: 92,
  },
  sectionTitle: {
    maxWidth: 800,
    color: "#1A1915",
    fontSize: 48,
    lineHeight: 52,
    fontWeight: "800",
    letterSpacing: -2,
  },
  sectionTitleCompact: {
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -1.2,
  },
  sectionLead: {
    maxWidth: 760,
    marginTop: 18,
    color: "#5F5D57",
    fontSize: 17,
    lineHeight: 28,
  },
  stepsGrid: {
    marginTop: 42,
    flexDirection: "row",
    gap: 14,
  },
  stack: {
    flexDirection: "column",
  },
  stepCard: {
    flex: 1,
    minHeight: 230,
    padding: 24,
    borderWidth: 1,
    borderColor: "#E5E3DA",
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
  },
  stepNumber: {
    color: "#3B6D11",
    fontSize: 12,
    fontWeight: "800",
  },
  stepTitle: {
    marginTop: 42,
    color: "#1A1915",
    fontSize: 20,
    fontWeight: "800",
  },
  stepDescription: {
    marginTop: 10,
    color: "#5F5D57",
    fontSize: 15,
    lineHeight: 24,
  },
  directSection: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#D6E4C9",
    backgroundColor: "#EEF4E9",
  },
  directInner: {
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingVertical: 92,
    flexDirection: "row",
    alignItems: "center",
    gap: 64,
  },
  directInnerCompact: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: 36,
  },
  directCopy: {
    flex: 1.1,
  },
  bodyText: {
    maxWidth: 650,
    marginTop: 22,
    color: "#5F5D57",
    fontSize: 18,
    lineHeight: 30,
  },
  flowCard: {
    flex: 0.9,
    maxWidth: 430,
    padding: 28,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D6E4C9",
  },
  flowNodePrimary: {
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "#27500A",
  },
  flowNodePrimaryText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  flowArrow: {
    paddingVertical: 9,
    textAlign: "center",
    color: "#3B6D11",
    fontSize: 20,
    fontWeight: "800",
  },
  flowNode: {
    padding: 18,
    borderWidth: 1,
    borderColor: "#B8D5A2",
    borderRadius: 14,
    backgroundColor: "#F7FBF3",
  },
  flowNodeMuted: {
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E3DA",
    borderRadius: 14,
    backgroundColor: "#F7F6F3",
  },
  flowNodeTitle: {
    color: "#1A1915",
    fontSize: 16,
    fontWeight: "800",
  },
  flowNodeMeta: {
    marginTop: 5,
    color: "#706E68",
    fontSize: 13,
    lineHeight: 20,
  },
  calculator: {
    marginTop: 40,
    flexDirection: "row",
    gap: 22,
    alignItems: "stretch",
  },
  calculatorCompact: {
    flexDirection: "column",
  },
  calculatorInputs: {
    flex: 1,
    padding: 26,
    borderWidth: 1,
    borderColor: "#E5E3DA",
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
  },
  inputGroup: {
    marginBottom: 18,
  },
  inputLabel: {
    marginBottom: 8,
    color: "#1A1915",
    fontSize: 14,
    fontWeight: "700",
  },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#D3D1C7",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    color: "#1A1915",
    fontSize: 18,
    fontWeight: "700",
  },
  mathExplanation: {
    marginTop: 6,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: "#E5E3DA",
  },
  mathLine: {
    color: "#1A1915",
    fontSize: 15,
    fontWeight: "800",
  },
  mathSmall: {
    marginTop: 5,
    color: "#706E68",
    fontSize: 12,
    lineHeight: 18,
  },
  resultCard: {
    flex: 1,
    padding: 30,
    borderRadius: 20,
    justifyContent: "center",
    backgroundColor: "#1A1915",
  },
  resultEyebrow: {
    color: "#B8D5A2",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  resultAmount: {
    marginTop: 14,
    color: "#FFFFFF",
    fontSize: 58,
    lineHeight: 62,
    fontWeight: "800",
    letterSpacing: -2,
  },
  resultPeriod: {
    color: "#D3D1C7",
    fontSize: 15,
  },
  resultAnnual: {
    marginTop: 18,
    color: "#B8D5A2",
    fontSize: 18,
    fontWeight: "800",
  },
  resultNote: {
    marginTop: 12,
    color: "#AAA79F",
    fontSize: 12,
    lineHeight: 19,
  },
  whySection: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E5E3DA",
  },
  whyInner: {
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingVertical: 92,
  },
  whyText: {
    maxWidth: 820,
    marginTop: 24,
    color: "#5F5D57",
    fontSize: 19,
    lineHeight: 32,
  },
  rulesSection: {
    backgroundColor: "#FAFAF8",
  },
  rulesInner: {
    width: "100%",
    maxWidth: 900,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingVertical: 92,
  },
  effective: {
    marginTop: 12,
    color: "#706E68",
    fontSize: 13,
    fontWeight: "600",
  },
  rulesCard: {
    marginTop: 34,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E3DA",
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
  },
  rule: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E3DA",
  },
  ruleLast: {
    borderBottomWidth: 0,
  },
  ruleTitle: {
    color: "#1A1915",
    fontSize: 16,
    fontWeight: "800",
  },
  ruleText: {
    marginTop: 8,
    color: "#5F5D57",
    fontSize: 14,
    lineHeight: 23,
  },
  rulesNote: {
    marginTop: 18,
    color: "#8A8880",
    fontSize: 11,
    lineHeight: 18,
  },
  finalSection: {
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingVertical: 86,
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
    maxWidth: 700,
    color: "#FFFFFF",
    fontSize: 38,
    lineHeight: 43,
    fontWeight: "800",
    letterSpacing: -1.4,
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
    gap: 14,
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
  legalCompact: {
    flexDirection: "column",
    gap: 8,
  },
  legalText: {
    maxWidth: 650,
    color: "#8A8880",
    fontSize: 11,
    lineHeight: 17,
  },
});
