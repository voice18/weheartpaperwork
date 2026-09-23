import { usePublicCompact } from "../../hooks/usePublicCompact";
import { StyleSheet, Text, View } from "react-native";

export default function FounderVideo() {
  const compact = usePublicCompact();

  return (
    <View style={styles.section}>
      <View style={[styles.inner, compact && styles.innerCompact]}>
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>MEET THE FOUNDER</Text>
          <h2 style={{ maxWidth: 650, margin: 0, color: "#1A1915", fontSize: compact ? 32 : 44, lineHeight: compact ? "37px" : "49px", fontWeight: 800, letterSpacing: compact ? -1 : -1.7 }}>
            Built for my trucking company. Shared with yours.
          </h2>
          <Text style={styles.description}>
            Aaron explains why he built We Heart Paperwork and how it helps
            carriers keep their paperwork and deadlines organized.
          </Text>
          <Text style={styles.duration}>Watch the short introduction.</Text>
        </View>
        <View style={styles.videoFrame}>
          <video
            aria-label="Aaron introduces We Heart Paperwork"
            controls
            playsInline
            preload="none"
            poster="/videos/founder-story.jpg"
            style={{ display: "block", width: "100%", height: "auto", aspectRatio: "9 / 16", borderRadius: 18 }}
          >
            <source src="/videos/founder-story.mp4" type="video/mp4" />
            Your browser does not support video playback.
          </video>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { backgroundColor: "#F6F3EA", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#E5E3DA" },
  inner: { width: "100%", maxWidth: 1120, alignSelf: "center", paddingHorizontal: 24, paddingVertical: 72, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 48 },
  innerCompact: { flexDirection: "column", alignItems: "stretch", paddingVertical: 56, gap: 32 },
  copy: { flex: 1 },
  eyebrow: { marginBottom: 14, color: "#3B6D11", fontSize: 12, fontWeight: "800", letterSpacing: 1.2 },
  description: { maxWidth: 650, marginTop: 20, color: "#5F5D57", fontSize: 18, lineHeight: 29 },
  duration: { marginTop: 16, color: "#706E68", fontSize: 13 },
  videoFrame: { width: "100%", maxWidth: 320, alignSelf: "center", borderRadius: 18, backgroundColor: "#1A1915", overflow: "hidden" },
});
