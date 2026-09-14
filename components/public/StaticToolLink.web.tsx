import type { ComponentType } from "react";
import { Pressable } from "react-native";
import type { StaticToolLinkProps } from "./StaticToolLink";

// React Native Web supports href on Pressable and renders an ordinary anchor.
// Let the browser navigate to static HTML, including modified/new-tab clicks.
const WebLink = Pressable as ComponentType<StaticToolLinkProps>;

export default function StaticToolLink(props: StaticToolLinkProps) {
  return <WebLink {...props} accessibilityRole="link" />;
}
