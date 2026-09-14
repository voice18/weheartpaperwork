import { Pressable, type PressableProps } from "react-native";
import { openStaticTool } from "../../lib/openStaticTool";

export type StaticToolLinkProps = Omit<PressableProps, "onPress"> & { href: string };

export default function StaticToolLink({ href, ...props }: StaticToolLinkProps) {
  return <Pressable {...props} accessibilityRole="link" onPress={() => openStaticTool(href)} />;
}
