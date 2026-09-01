import { useEffect, useState } from "react";
import {
  Platform,
  useWindowDimensions,
} from "react-native";

export function usePublicCompact(breakpoint = 760) {
  const { width } = useWindowDimensions();
  const [webWidth, setWebWidth] = useState<number | null>(null);

  useEffect(() => {
    if (
      Platform.OS !== "web" ||
      typeof window === "undefined"
    ) {
      return;
    }

    const updateWidth = () => {
      setWebWidth(window.innerWidth);
    };

    updateWidth();

    window.addEventListener("resize", updateWidth);

    return () => {
      window.removeEventListener("resize", updateWidth);
    };
  }, []);

  if (Platform.OS === "web") {
    // Static HTML is rendered as the normal desktop layout.
    // The real browser width is applied immediately after hydration.
    return webWidth === null
      ? false
      : webWidth < breakpoint;
  }

  return width < breakpoint;
}