import { useEffect, useState, type ComponentType } from "react";
import { Platform, Pressable, StyleSheet, Text, View, type PressableProps } from "react-native";
import { ANDROID_PLAY_STORE_URL, IOS_APP_STORE_URL } from "../../lib/appStore";

const WebLink = Pressable as ComponentType<PressableProps & {
  href: string;
  hrefAttrs: { target: string; rel: string };
}>;

export default function AppStoreLink({ prominent = false, existingAccount = false }: { prominent?: boolean; existingAccount?: boolean }) {
  const [deviceStore, setDeviceStore] = useState<"apple" | "android" | "desktop">("desktop");

  useEffect(() => {
    if (typeof navigator === "undefined") return;

    const userAgent = navigator.userAgent ?? "";
    if (/Android/i.test(userAgent)) {
      setDeviceStore("android");
      return;
    }

    const isAppleMobile = /iPhone|iPad|iPod/i.test(userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (isAppleMobile) setDeviceStore("apple");
  }, []);

  if (Platform.OS !== "web") return null;

  const storeLinks = deviceStore === "android"
    ? [{ href: ANDROID_PLAY_STORE_URL, label: prominent ? "Download on Google Play" : "Get the Android app", accessibilityLabel: "Download We Heart Paperwork on Google Play (opens in a new tab)" }]
    : deviceStore === "apple"
      ? [{ href: IOS_APP_STORE_URL, label: prominent ? "Download on the App Store" : "Get the iPhone app", accessibilityLabel: "Download We Heart Paperwork on the App Store (opens in a new tab)" }]
      : [
          { href: IOS_APP_STORE_URL, label: prominent ? "Download on the App Store" : "Get the iPhone app", accessibilityLabel: "Download We Heart Paperwork on the App Store (opens in a new tab)" },
          { href: ANDROID_PLAY_STORE_URL, label: prominent ? "Download on Google Play" : "Get the Android app", accessibilityLabel: "Download We Heart Paperwork on Google Play (opens in a new tab)" },
        ];

  return <View style={styles.container}>
    <Text style={styles.note}>{existingAccount ? "The companion app uses your website account. An active trial or subscription is required for access." : "Companion app — website account required. Sign up and complete setup at weheartpaperwork.com first, then sign in to the app with the same email and password. An active trial or subscription is required."}</Text>
    {!existingAccount && <WebLink href="https://weheartpaperwork.com/login?mode=create" hrefAttrs={{ target: "_self", rel: "" }} accessibilityRole="link" style={styles.link}><Text style={styles.linkText}>Create your website account</Text></WebLink>}
    {storeLinks.map(store => (
      <WebLink key={store.href} href={store.href} hrefAttrs={{ target: "_blank", rel: "noopener noreferrer" }} accessibilityRole="link" accessibilityLabel={store.accessibilityLabel} style={prominent ? styles.button : styles.link}>
        <Text style={prominent ? styles.buttonText : styles.linkText}>{store.label}</Text>
      </WebLink>
    ))}
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
