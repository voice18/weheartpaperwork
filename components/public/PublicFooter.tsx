import { Link } from "expo-router";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { openStaticTool } from "../../lib/openStaticTool";

import { usePublicCompact } from "../../hooks/usePublicCompact";

export default function PublicFooter() {
  const compact = usePublicCompact();

  return (
    <>
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
            Built by a trucking company for trucking companies.
          </Text>
        </View>

        <View
          style={[
            styles.footerLinks,
            compact && styles.footerLinksCompact,
          ]}
        >
          <Link href="/features" asChild>
            <Pressable>
              <Text style={styles.footerLink}>Features</Text>
            </Pressable>
          </Link>

          <Link href="/pricing" asChild>
            <Pressable>
              <Text style={styles.footerLink}>Pricing</Text>
            </Pressable>
          </Link>

          <Link href="/about" asChild>
            <Pressable>
              <Text style={styles.footerLink}>About</Text>
            </Pressable>
          </Link>

          <Link href="/tools/mcs-150-due-date-calculator" asChild>
            <Pressable>
              <Text style={styles.footerLink}>
                Free MCS-150 Tool
              </Text>
            </Pressable>
          </Link>

          <Link href="/compliance" asChild>
            <Pressable>
              <Text style={styles.footerLink}>
                Compliance Guides
              </Text>
            </Pressable>
          </Link>

          <Pressable accessibilityRole="link" onPress={() => openStaticTool("/tools/new-entrant-audit/")}><Text style={styles.footerLink}>New Entrant Audit Tool</Text></Pressable>

          <Pressable accessibilityRole="link" onPress={() => openStaticTool("/tools/driver-qualification-file/")}><Text style={styles.footerLink}>DQ File Builder</Text></Pressable>

          <Pressable accessibilityRole="link" onPress={() => openStaticTool("/tools/vehicle-maintenance-file/")}><Text style={styles.footerLink}>Maintenance File Builder</Text></Pressable>

          <Pressable accessibilityRole="link" onPress={() => openStaticTool("/tools/accident-register/")}><Text style={styles.footerLink}>Accident Register Builder</Text></Pressable>

          <Pressable accessibilityRole="link" onPress={() => openStaticTool("/tools/what-do-i-need/")}><Text style={styles.footerLink}>Paperwork Checklist Tool</Text></Pressable>

          <Link href={"/how-to" as any} asChild>
            <Pressable><Text style={styles.footerLink}>How-To Walkthroughs</Text></Pressable>
          </Link>

          <Link href={"/fmcsa-updates" as any} asChild>
            <Pressable>
              <Text style={styles.footerLink}>FMCSA Updates</Text>
            </Pressable>
          </Link>

          <Link href={"/for-owner-operators" as any} asChild>
            <Pressable>
              <Text style={styles.footerLink}>Owner-Operators</Text>
            </Pressable>
          </Link>

          <Link href={"/compliance-service-or-tracker" as any} asChild>
            <Pressable>
              <Text style={styles.footerLink}>Service or Tracker?</Text>
            </Pressable>
          </Link>

          <Link href="/referrals" asChild>
            <Pressable>
              <Text style={styles.footerLink}>
                Referral Rewards
              </Text>
            </Pressable>
          </Link>

          <Link href="/support" asChild>
            <Pressable>
              <Text style={styles.footerLink}>Support</Text>
            </Pressable>
          </Link>

          <Link href="/privacy" asChild>
            <Pressable>
              <Text style={styles.footerLink}>Privacy</Text>
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
    </>
  );
}

const styles = StyleSheet.create({
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
    flexWrap: "wrap",
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
