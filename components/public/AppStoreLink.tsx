import type { ComponentType } from "react";
import { Platform, Pressable, StyleSheet, Text, View, type PressableProps } from "react-native";
import { IOS_APP_STORE_URL } from "../../lib/appStore";

const WebLink = Pressable as ComponentType<PressableProps & {
  href: string;
  hrefAttrs: { target: string; rel: string };
}>;

export default function AppStoreLink({ prominent = false, existingAccount = false }: { prominent?: boolean; existingAccount?: boolean }) {
  if (Platform.OS !== "web") return null;
  return <View style={styles.container}>
    <Text style={styles.note}>{existingAccount ? "The companion app uses your website account. An active trial or subscription is required for access." : "Companion app — website account required. Sign up and complete setup at weheartpaperwork.com first, then sign in to the app with the same email and password. An active trial or subscription is required."}</Text>
    {!existingAccount && <WebLink href="https://weheartpaperwork.com/login?mode=create" hrefAttrs={{ target: "_self", rel: "" }} accessibilityRole="link" style={styles.link}><Text style={styles.linkText}>Create your website account</Text></WebLink>}
    <WebLink href={IOS_APP_STORE_URL} hrefAttrs={{ target: "_blank", rel: "noopener noreferrer" }} accessibilityRole="link" accessibilityLabel="Download We Heart Paperwork on the App Store (opens in a new tab)" style={prominent ? styles.button : styles.link}>
      <Text style={prominent ? styles.buttonText : styles.linkText}>{prominent ? "Download on the App Store" : "Get the iPhone app"}</Text>
    </WebLink>
  </View>;
}

const styles = StyleSheet.create({
  container: { maxWidth: 320, flexShrink: 1, alignSelf: "flex-start", gap: 4 },
  note: { color: "#5F5D57", fontSize: 13, lineHeight: 19 },
  link: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  linkText: { color: "#27500A", fontSize: 14, fontWeight: "700" },
  button: { minHeight: 44, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, backgroundColor: "#1A1915", alignSelf: "flex-start", justifyContent: "center" },
  buttonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
});
