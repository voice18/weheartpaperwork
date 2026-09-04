import { useMemo, useState } from "react";
import { Link } from "expo-router";
import PublicHeader from "../../components/public/PublicHeader";
import Head from "expo-router/head";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { usePublicCompact } from "../../hooks/usePublicCompact";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type DueResult =
  | { ok: false; error: string }
  | {
      ok: true;
      usdot: string;
      monthName: string;
      parity: "odd" | "even";
      nextDue: Date;
      prevDue: Date | null;
      overdueThisCycle: boolean;
      lastDigit: string;
      nextToLastDigit: string;
    };

function mcs150DueDate(input: string, today = new Date()): DueResult {
  const digits = String(input ?? "").replace(/\D/g, "");

  if (!digits.length) {
    return { ok: false, error: "Enter your USDOT number to get started." };
  }

  if (digits.length < 2) {
    return {
      ok: false,
      error: "Enter at least two digits so the filing year can be determined.",
    };
  }

  if (digits.length > 9) {
    return {
      ok: false,
      error: "That looks longer than a USDOT number. Check the digits and try again.",
    };
  }

  const lastDigit = Number(digits.charAt(digits.length - 1));
  const nextToLast = Number(digits.charAt(digits.length - 2));
  const monthIndex = lastDigit === 0 ? 9 : lastDigit - 1;
  const parity = nextToLast % 2;

  const current = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  let nextDue: Date | null = null;
  let prevDue: Date | null = null;

  for (
    let year = current.getFullYear() - 4;
    year <= current.getFullYear() + 8;
    year += 1
  ) {
    if (year % 2 !== parity) continue;

    const candidate = new Date(year, monthIndex + 1, 0);

    if (candidate >= current && !nextDue) {
      nextDue = candidate;
      break;
    }

    prevDue = candidate;
  }

  if (!nextDue) {
    return {
      ok: false,
      error: "We could not calculate the next date. Check the USDOT number and try again.",
    };
  }

  return {
    ok: true,
    usdot: digits,
    monthName: MONTHS[monthIndex],
    parity: parity === 1 ? "odd" : "even",
    nextDue,
    prevDue,
    overdueThisCycle:
      Boolean(prevDue) &&
      prevDue!.getFullYear() === current.getFullYear(),
    lastDigit: digits.charAt(digits.length - 1),
    nextToLastDigit: digits.charAt(digits.length - 2),
  };
}

function formatDate(date: Date) {
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function daysUntil(date: Date, today = new Date()) {
  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  return Math.round((date.getTime() - start.getTime()) / 86400000);
}

export default function Mcs150DueDateCalculatorPage() {
  const compact = usePublicCompact();

  const [usdotInput, setUsdotInput] = useState("");
  const [submitted, setSubmitted] = useState("");

  const result = useMemo(
    () => (submitted ? mcs150DueDate(submitted) : null),
    [submitted]
  );

  const calculate = () => setSubmitted(usdotInput);

  return (
    <>
      <Head>
        <title>MCS-150 Due Date Calculator — Free USDOT Number Lookup</title>
        <meta
          name="description"
          content="Enter your USDOT number and calculate your scheduled MCS-150 biennial update date. Free, instant, no signup, with the FMCSA digit rule explained."
        />
        <link
          rel="canonical"
          href="https://weheartpaperwork.com/tools/mcs-150-due-date-calculator"
        />
      </Head>

      <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
        <PublicHeader />

        <View style={[styles.hero, compact && styles.heroCompact]}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>FREE TOOL</Text>

            <Text style={[styles.heroTitle, compact && styles.heroTitleCompact]}>
              MCS-150 Due Date
            </Text>

            <Text style={[styles.heroAccent, compact && styles.heroTitleCompact]}>
              Calculator
            </Text>

            <Text style={styles.heroDescription}>
              Your scheduled biennial update month and filing year are
              determined by your USDOT number. Enter it below and we will do
              the math.
            </Text>
          </View>

          <View style={[styles.calculatorCard, compact && styles.calculatorCardCompact]}>
            <Text style={styles.label}>USDOT number</Text>

            <Text style={styles.hint}>
              Digits only. The calculation runs on this page and does not send
              the number to FMCSA.
            </Text>

            <View style={[styles.inputRow, compact && styles.inputRowCompact]}>
              <TextInput
                value={usdotInput}
                onChangeText={setUsdotInput}
                onSubmitEditing={calculate}
                keyboardType="number-pad"
                placeholder="e.g. 3216547"
                placeholderTextColor="#A3A098"
                style={styles.input}
                returnKeyType="done"
              />

              <Pressable style={styles.primaryButton} onPress={calculate}>
                <Text style={styles.primaryButtonText}>Find my due date</Text>
              </Pressable>
            </View>

            {result ? <ResultCard result={result} /> : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.eyebrow}>HOW THE RULE WORKS</Text>

          <Text style={[styles.sectionTitle, compact && styles.sectionTitleCompact]}>
            Two digits determine the biennial schedule.
          </Text>

          <View style={[styles.ruleGrid, compact && styles.ruleGridCompact]}>
            <View style={styles.ruleCard}>
              <Text style={styles.ruleNumber}>01</Text>
              <Text style={styles.ruleTitle}>The last digit sets the month</Text>
              <Text style={styles.ruleText}>
                1 means January, 2 means February, and so on through 9 for
                September. A final 0 means October.
              </Text>
            </View>

            <View style={styles.ruleCard}>
              <Text style={styles.ruleNumber}>02</Text>
              <Text style={styles.ruleTitle}>
                The next-to-last digit sets the year
              </Text>
              <Text style={styles.ruleText}>
                An odd digit means odd-numbered years. An even digit means
                even-numbered years.
              </Text>
            </View>
          </View>

          <View style={styles.exampleCard}>
            <Text style={styles.exampleEyebrow}>WORKED EXAMPLE</Text>
            <Text style={styles.exampleTitle}>USDOT 3216547</Text>
            <Text style={styles.exampleText}>
              The last digit is 7, so the month is July. The next-to-last
              digit is 4, which is even, so the scheduled filing is due by the
              last day of July in even-numbered years.
            </Text>
          </View>
        </View>

        <View style={styles.greenSection}>
          <View style={styles.greenInner}>
            <Text style={styles.eyebrow}>
              KNOW THE DATE. THEN STOP RELYING ON MEMORY.
            </Text>

            <Text style={[styles.sectionTitle, compact && styles.sectionTitleCompact]}>
              We Heart Paperwork keeps recurring company and driver deadlines together.
            </Text>

            <Text style={styles.greenText}>
              Track the dates, reminders, and completion history that are easy
              to lose while the rest of the company keeps moving.
            </Text>

            <Link href="/pricing" asChild>
              <Pressable style={styles.greenButton}>
                <Text style={styles.greenButtonText}>See pricing</Text>
              </Pressable>
            </Link>

            <Text style={styles.priceNote}>
              $2/month + $1 per active driver.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.eyebrow}>COMMON QUESTIONS</Text>

          <Question
            question="Do I only update the MCS-150 on the biennial schedule?"
            answer="No. The biennial schedule is the recurring filing requirement. Certain changes to your carrier information can require an update sooner, so the calculator should not be treated as a substitute for checking current FMCSA requirements."
          />

          <Question
            question="What does the biennial update cost?"
            answer="FMCSA does not charge a filing fee for the MCS-150 biennial update. Third-party services may charge to prepare or submit it for you."
          />

          <Question
            question="What if I miss the scheduled update?"
            answer="Missing a required biennial update can normally lead to enforcement consequences, including USDOT inactivation and civil penalties. FMCSA procedures can change, so check current agency guidance if you are already late."
          />

          <Question
            question="Where should I verify my carrier record?"
            answer="Use FMCSA's current registration system and official guidance. We Heart Paperwork is not connected to FMCSA and this calculator does not look up or change your federal record."
            last
          />

          <Pressable
            onPress={() =>
              Linking.openURL(
                "https://www.fmcsa.dot.gov/registration/updating-your-registration"
              )
            }
            style={styles.sourceButton}
          >
            <Text style={styles.sourceButtonText}>
              View the official FMCSA source
            </Text>
          </Pressable>

          <Text style={styles.sourceNote}>
            General information only. Regulations and FMCSA systems can change.
            Verify current requirements before relying on any compliance tool.
          </Text>
        </View>

        <Footer compact={compact} />
      </ScrollView>
    </>
  );
}

function ResultCard({ result }: { result: DueResult }) {
  if (!result.ok) {
    return (
      <View style={[styles.resultCard, styles.resultError]}>
        <Text style={styles.resultErrorText}>{result.error}</Text>
      </View>
    );
  }

  const days = daysUntil(result.nextDue);

  const countdown =
    days === 0
      ? "That is today."
      : days === 1
      ? "That is tomorrow."
      : `${days.toLocaleString()} days away.`;

  return (
    <View
      style={[
        styles.resultCard,
        result.overdueThisCycle ? styles.resultWarning : styles.resultGood,
      ]}
    >
      {result.overdueThisCycle && result.prevDue ? (
        <>
          <Text style={styles.resultLabel}>HEADS UP</Text>

          <Text style={styles.warningText}>
            The scheduled update for this cycle was {formatDate(result.prevDue)}.
            If you have not filed it, check your FMCSA record and current
            agency guidance.
          </Text>

          <Text style={styles.nextLabel}>
            Your next scheduled biennial date:
          </Text>
        </>
      ) : (
        <Text style={styles.resultLabel}>
          YOUR NEXT SCHEDULED MCS-150 UPDATE
        </Text>
      )}

      <Text style={styles.resultDate}>{formatDate(result.nextDue)}</Text>
      <Text style={styles.countdown}>{countdown}</Text>

      <View style={styles.reasonDivider} />

      <Text style={styles.reasonText}>
        USDOT {result.usdot} ends in {result.lastDigit}, which means{" "}
        {result.monthName}. The next-to-last digit is {result.nextToLastDigit},
        which is {result.parity}, so the biennial filing falls in{" "}
        {result.parity}-numbered years.
      </Text>
    </View>
  );
}


function Question({
  question,
  answer,
  last = false,
}: {
  question: string;
  answer: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.question, last && styles.questionLast]}>
      <Text style={styles.questionTitle}>{question}</Text>
      <Text style={styles.questionText}>{answer}</Text>
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
  loginButton: { minHeight: 40, paddingHorizontal: 16, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#27500A" },
  loginButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  hero: { width: "100%", maxWidth: 1120, alignSelf: "center", paddingHorizontal: 24, paddingTop: 92, paddingBottom: 92, flexDirection: "row", alignItems: "center", gap: 64 },
  heroCompact: { paddingHorizontal: 18, paddingTop: 56, paddingBottom: 64, flexDirection: "column", alignItems: "stretch", gap: 42 },
  heroCopy: { flex: 0.95, minWidth: 280 },
  eyebrow: { marginBottom: 14, color: "#3B6D11", fontSize: 12, lineHeight: 17, fontWeight: "800", letterSpacing: 1.2 },
  heroTitle: { color: "#1A1915", fontSize: 54, lineHeight: 57, fontWeight: "800", letterSpacing: -2.5 },
  heroAccent: { color: "#3B6D11", fontSize: 54, lineHeight: 57, fontWeight: "800", letterSpacing: -2.5 },
  heroTitleCompact: { fontSize: 40, lineHeight: 43, letterSpacing: -1.6 },
  heroDescription: { maxWidth: 620, marginTop: 26, color: "#5F5D57", fontSize: 19, lineHeight: 30 },
  calculatorCard: { flex: 1.05, minWidth: 360, maxWidth: 520, padding: 28, borderWidth: 1, borderColor: "#E5E3DA", borderRadius: 26, backgroundColor: "#FFFFFF", shadowColor: "#1F2B14", shadowOffset: { width: 0, height: 24 }, shadowOpacity: 0.12, shadowRadius: 40 },
  calculatorCardCompact: { width: "100%", minWidth: 0, maxWidth: 600, alignSelf: "center" },
  label: { color: "#1A1915", fontSize: 15, fontWeight: "800" },
  hint: { marginTop: 6, color: "#706E68", fontSize: 12, lineHeight: 18 },
  inputRow: { marginTop: 18, flexDirection: "row", gap: 10 },
  inputRowCompact: { flexDirection: "column" },
  input: { flex: 1, minHeight: 50, paddingHorizontal: 15, borderWidth: 1, borderColor: "#D3D1C7", borderRadius: 11, color: "#1A1915", backgroundColor: "#FFFFFF", fontSize: 17 },
  primaryButton: { minHeight: 50, paddingHorizontal: 18, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#27500A" },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  resultCard: { marginTop: 20, padding: 20, borderRadius: 15, borderWidth: 1 },
  resultGood: { backgroundColor: "#EEF4E9", borderColor: "#D6E4C9" },
  resultWarning: { backgroundColor: "#FAEEDA", borderColor: "#E9D0A8" },
  resultError: { backgroundColor: "#FCEAEA", borderColor: "#E9C6C6" },
  resultErrorText: { color: "#8A2E2E", fontSize: 14, fontWeight: "700" },
  resultLabel: { color: "#5F5D57", fontSize: 10, fontWeight: "800", letterSpacing: 1.1 },
  warningText: { marginTop: 7, color: "#6E4814", fontSize: 14, lineHeight: 22 },
  nextLabel: { marginTop: 15, color: "#5F5D57", fontSize: 12, fontWeight: "700" },
  resultDate: { marginTop: 7, color: "#1A1915", fontSize: 31, lineHeight: 36, fontWeight: "800", letterSpacing: -0.8 },
  countdown: { marginTop: 3, color: "#5F5D57", fontSize: 14 },
  reasonDivider: { height: 1, marginVertical: 16, backgroundColor: "#D6D5CD" },
  reasonText: { color: "#5F5D57", fontSize: 13, lineHeight: 21 },
  section: { width: "100%", maxWidth: 1120, alignSelf: "center", paddingHorizontal: 24, paddingVertical: 100 },
  sectionTitle: { maxWidth: 820, color: "#1A1915", fontSize: 46, lineHeight: 50, fontWeight: "800", letterSpacing: -1.9 },
  sectionTitleCompact: { fontSize: 34, lineHeight: 38, letterSpacing: -1.1 },
  ruleGrid: { marginTop: 44, flexDirection: "row", gap: 18 },
  ruleGridCompact: { flexDirection: "column" },
  ruleCard: { flex: 1, minHeight: 220, padding: 26, borderWidth: 1, borderColor: "#E5E3DA", borderRadius: 20, backgroundColor: "#FFFFFF" },
  ruleNumber: { marginBottom: 40, color: "#3B6D11", fontSize: 12, fontWeight: "800" },
  ruleTitle: { color: "#1A1915", fontSize: 20, fontWeight: "800" },
  ruleText: { marginTop: 10, color: "#5F5D57", fontSize: 15, lineHeight: 24 },
  exampleCard: { marginTop: 18, padding: 28, borderWidth: 1, borderColor: "#D6E4C9", borderRadius: 20, backgroundColor: "#EEF4E9" },
  exampleEyebrow: { color: "#3B6D11", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  exampleTitle: { marginTop: 8, color: "#1A1915", fontSize: 22, fontWeight: "800" },
  exampleText: { marginTop: 10, maxWidth: 760, color: "#5F5D57", fontSize: 15, lineHeight: 25 },
  greenSection: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#D6E4C9", backgroundColor: "#EEF4E9" },
  greenInner: { width: "100%", maxWidth: 1120, alignSelf: "center", paddingHorizontal: 24, paddingVertical: 100 },
  greenText: { maxWidth: 760, marginTop: 22, color: "#5F5D57", fontSize: 18, lineHeight: 29 },
  greenButton: { alignSelf: "flex-start", minHeight: 50, marginTop: 28, paddingHorizontal: 20, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#27500A" },
  greenButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  priceNote: { marginTop: 12, color: "#706E68", fontSize: 12 },
  question: { paddingVertical: 27, borderBottomWidth: 1, borderBottomColor: "#E5E3DA" },
  questionLast: { borderBottomWidth: 0 },
  questionTitle: { color: "#1A1915", fontSize: 18, fontWeight: "800" },
  questionText: { maxWidth: 800, marginTop: 9, color: "#5F5D57", fontSize: 15, lineHeight: 25 },
  sourceButton: { alignSelf: "flex-start", minHeight: 46, marginTop: 28, paddingHorizontal: 18, borderWidth: 1, borderColor: "#D3D1C7", borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  sourceButtonText: { color: "#27500A", fontSize: 13, fontWeight: "800" },
  sourceNote: { maxWidth: 760, marginTop: 16, color: "#8A8880", fontSize: 11, lineHeight: 18 },
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
