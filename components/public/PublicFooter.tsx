import { Link } from "expo-router";
import { type ComponentType } from "react";
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
} from "react-native";
import StaticToolLink from "./StaticToolLink";
import AppStoreLink from "./AppStoreLink";
import {
  SUPPORT_EMAIL,
  SUPPORT_PHONE_DISPLAY,
  SUPPORT_PHONE_E164,
} from "../../lib/contact";

import { usePublicCompact } from "../../hooks/usePublicCompact";

const WebLink = Pressable as ComponentType<PressableProps & {
  href: string;
  hrefAttrs: { target: string; rel: string };
}>;

const socialLinks = [
  {
    label: "LinkedIn",
    accessibilityLabel: "Visit founder Aaron Attig on LinkedIn",
    href: "https://www.linkedin.com/in/aaron-attig-37b68643/",
    icon: require("../../public/social/LinkedIn-48x48.png"),
  },
  {
    label: "Facebook",
    accessibilityLabel: "Visit We Heart Paperwork on Facebook",
    href: "https://www.facebook.com/profile.php?id=61594699970425",
    icon: require("../../public/social/Facebook-48x48.png"),
  },
  {
    label: "Instagram",
    accessibilityLabel: "Visit We Heart Paperwork on Instagram",
    href: "https://www.instagram.com/weheartpaperwork/",
    icon: require("../../public/social/Instagram-48x48.png"),
  },
  {
    label: "TikTok",
    accessibilityLabel: "Visit Aaron Daniel Attig on TikTok",
    href: "https://www.tiktok.com/@aarondanielatt?lang=en",
    icon: require("../../public/social/TikTok-48x48.png"),
  },
  {
    label: "YouTube",
    accessibilityLabel: "Visit We Heart Paperwork on YouTube",
    href: "https://www.youtube.com/@Weheartpaperwork",
    icon: require("../../public/social/YouTube-48x48.png"),
  },
];

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
          <View style={styles.contactLinks}>
            <Link href={`tel:${SUPPORT_PHONE_E164}` as any} asChild>
              <Pressable accessibilityRole="link">
                <Text style={styles.contactLink}>{SUPPORT_PHONE_DISPLAY}</Text>
              </Pressable>
            </Link>
            <Link href={`mailto:${SUPPORT_EMAIL}`} asChild>
              <Pressable accessibilityRole="link">
                <Text style={styles.contactLink}>{SUPPORT_EMAIL}</Text>
              </Pressable>
            </Link>
          </View>
          <AppStoreLink />
          <View style={styles.socialSection}>
            <Text style={styles.socialHeading}>Follow along</Text>
            <View style={styles.socialLinks}>
              {socialLinks.map((social) => (
                Platform.OS === "web" ? (
                  <WebLink key={social.label} href={social.href} hrefAttrs={{ target: "_blank", rel: "noopener noreferrer" }} accessibilityRole="link" accessibilityLabel={social.accessibilityLabel} style={styles.socialLink}>
                    <Image source={social.icon} style={styles.socialIcon} />
                  </WebLink>
                ) : (
                  <Link key={social.label} href={social.href as any} asChild>
                    <Pressable accessibilityRole="link" accessibilityLabel={social.accessibilityLabel} style={styles.socialLink}>
                      <Image source={social.icon} style={styles.socialIcon} />
                    </Pressable>
                  </Link>
                )
              ))}
            </View>
          </View>
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

          <StaticToolLink href={"/tools/new-entrant-audit/"}><Text style={styles.footerLink}>New Entrant Audit Tool</Text></StaticToolLink>

          <StaticToolLink href={"/tools/driver-qualification-file/"}><Text style={styles.footerLink}>DQ File Builder</Text></StaticToolLink>

          <StaticToolLink href={"/tools/drug-alcohol-policy/"}><Text style={styles.footerLink}>Drug &amp; Alcohol Policy Builder</Text></StaticToolLink>

          <StaticToolLink href={"/tools/vehicle-maintenance-file/"}><Text style={styles.footerLink}>Maintenance File Builder</Text></StaticToolLink>

          <StaticToolLink href={"/tools/accident-register/"}><Text style={styles.footerLink}>Accident Register Builder</Text></StaticToolLink>

          <StaticToolLink href={"/tools/what-do-i-need/"}><Text style={styles.footerLink}>Paperwork Checklist Tool</Text></StaticToolLink>

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

          <Link href={"/reviews" as any} asChild>
            <Pressable><Text style={styles.footerLink}>Customer Reviews</Text></Pressable>
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

  contactLinks: {
    marginTop: 12,
    marginBottom: 12,
    alignItems: "flex-start",
    gap: 6,
  },

  contactLink: {
    color: "#27500A",
    fontSize: 13,
    fontWeight: "700",
  },

  socialSection: {
    marginTop: 20,
  },

  socialHeading: {
    color: "#706E68",
    fontSize: 13,
    fontWeight: "700",
  },

  socialLinks: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },

  socialLink: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  socialIcon: {
    width: 36,
    height: 36,
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
