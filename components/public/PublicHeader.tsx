import { Link, usePathname } from "expo-router";
import { useEffect, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { usePublicCompact } from "../../hooks/usePublicCompact";
import StaticToolLink from "./StaticToolLink";
import AppStoreLink from "./AppStoreLink";

export default function PublicHeader() {
  const pathname = usePathname();
  const compact = usePublicCompact(1200);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { setMenuOpen(false); }, [pathname, compact]);

  const linkStyle = (path: string) => [
    styles.headerLink,
    pathname === path && styles.headerLinkActive,
  ];

  return (
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

            <Text style={[styles.brandName, compact && styles.brandNameCompact]}>
              We Heart Paperwork
            </Text>
          </Pressable>
        </Link>

        {compact && <Pressable accessibilityRole="button" accessibilityLabel={menuOpen ? "Close navigation menu" : "Open navigation menu"} accessibilityState={{ expanded: menuOpen }} onPress={() => setMenuOpen(!menuOpen)} style={styles.signInButton}>
          <Text style={styles.signInButtonText}>{menuOpen ? "Close" : "Menu"}</Text>
        </Pressable>}

        <View
          style={[
            styles.headerLinks,
            compact && styles.headerLinksCompact,
            compact && !menuOpen && styles.hidden,
          ]}
        >
          <Link href="/features" asChild>
            <Pressable>
              <Text style={linkStyle("/features")}>
                What We Track
              </Text>
            </Pressable>
          </Link>

          <Link href={"/how-to" as any} asChild>
            <Pressable>
              <Text style={[styles.headerLink, pathname.startsWith("/how-to") && styles.headerLinkActive]}>How to Stay Compliant</Text>
            </Pressable>
          </Link>

          <Link href={"/fmcsa-updates" as any} asChild>
            <Pressable>
              <Text style={linkStyle("/fmcsa-updates")}>
                FMCSA Updates
              </Text>
            </Pressable>
          </Link>

          <StaticToolLink href={"/tools"}><Text style={[styles.headerLink, pathname.startsWith("/tools") && styles.headerLinkActive]}>Free Tools</Text></StaticToolLink>

          <Link href="/pricing" asChild><Pressable><Text style={linkStyle("/pricing")}>Pricing</Text></Pressable></Link>

          <View style={[styles.authActions, compact && styles.authActionsCompact]}>
            {compact && <AppStoreLink />}
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
  );
}

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: 1,
    borderBottomColor: "#E5E3DA",
    backgroundColor: "#FAFAF8",
  },

  headerInner: {
    width: "100%",
    maxWidth: 1280,
    alignSelf: "center",
    minHeight: 72,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
  },

  headerInnerCompact: {
    paddingHorizontal: 16,
    gap: 8,
    paddingTop: 14,
    paddingBottom: 14,
    flexWrap: "wrap",
  },

  brandRow: {
    flexShrink: 0,
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

  brandNameCompact: { fontSize: 14 },

  headerLinks: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },

  headerLinksCompact: {
    width: "100%",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 16,
    paddingVertical: 12,
  },

  hidden: { display: "none" },

  headerLink: {
    color: "#706E68",
    fontSize: 14,
    fontWeight: "500",
  },

  headerLinkActive: {
    color: "#27500A",
    fontWeight: "800",
  },

  authActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  authActionsCompact: { flexDirection: "column", alignItems: "flex-start" },

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
});
