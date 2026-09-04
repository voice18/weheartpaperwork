import { Linking, Platform } from "react-native";

export function openStaticTool(path: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.location.assign(path);
    return;
  }

  void Linking.openURL(`https://weheartpaperwork.com${path}`);
}
