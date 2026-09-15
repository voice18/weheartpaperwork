import type { ComponentType } from "react";
import { Platform, Pressable, StyleSheet, Text, type PressableProps } from "react-native";
import { IOS_APP_STORE_URL } from "../../lib/appStore";

const WebLink = Pressable as ComponentType<PressableProps & {
  href: string;
  hrefAttrs: { target: string; rel: string };
}>;

export default function AppStoreLink({ prominent = false }: { prominent?: boolean }) {
  if (Platform.OS !== "web") return null;
  return <WebLink href={IOS_APP_STORE_URL} hrefAttrs={{ target: "_blank", rel: "noopener noreferrer" }} accessibilityRole="link" accessibilityLabel="Download We Heart Paperwork on the App Store (opens in a new tab)" style={prominent ? styles.button : styles.link}>
      <Text style={prominent ? styles.buttonText : styles.linkText}>{prominent ? "Download on the App Store" : "Get the iPhone app"}</Text>
  </WebLink>;
}

const styles = StyleSheet.create({
  link: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  linkText: { color: "#27500A", fontSize: 14, fontWeight: "700" },
  button: { minHeight: 44, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, backgroundColor: "#1A1915", alignSelf: "flex-start", justifyContent: "center" },
  buttonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
});
