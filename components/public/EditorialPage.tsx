import { Link } from "expo-router";
import Head from "expo-router/head";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { usePublicCompact } from "../../hooks/usePublicCompact";
import PublicFooter from "./PublicFooter";
import PublicHeader from "./PublicHeader";
import JsonLd from "./JsonLd";

export type EditorialSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  callout?: string;
};

export default function EditorialPage(props: {
  title: string;
  description: string;
  canonical: string;
  eyebrow: string;
  heading: string;
  intro: string;
  reviewed?: string;
  sections: EditorialSection[];
  links?: Array<{ label: string; href: string }>;
  sources?: Array<{ label: string; url: string }>;
}) {
  const compact = usePublicCompact();

  return (
    <>
      <Head>
        <title>{props.title}</title>
        <meta name="description" content={props.description} />
        <link rel="canonical" href={props.canonical} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={props.title} />
        <meta property="og:description" content={props.description} />
        <meta property="og:url" content={props.canonical} />
      </Head>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: props.heading,
          description: props.description,
          mainEntityOfPage: props.canonical,
          author: {
            "@type": "Organization",
            name: "We Heart Paperwork",
            url: "https://weheartpaperwork.com/about",
          },
          publisher: {
            "@type": "Organization",
            name: "We Heart Paperwork",
            url: "https://weheartpaperwork.com",
          },
        }}
      />

      <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
        <PublicHeader />

        <View style={[styles.hero, compact && styles.heroCompact]}>
          <Text style={styles.eyebrow}>{props.eyebrow}</Text>
          <Text accessibilityRole="header" style={[styles.heroTitle, compact && styles.heroTitleCompact]}>
            {props.heading}
          </Text>
          <Text style={styles.intro}>{props.intro}</Text>
          {props.reviewed ? (
            <Text style={styles.reviewed}>Last reviewed {props.reviewed}</Text>
          ) : null}
          <Text style={styles.byline}>
            Written and maintained by We Heart Paperwork, built by a trucking company owner in Yakima, Washington.
          </Text>
        </View>

        <View style={styles.article}>
          {props.sections.map(section => (
            <View key={section.heading} style={styles.section}>
              <Text style={[styles.sectionTitle, compact && styles.sectionTitleCompact]}>
                {section.heading}
              </Text>
              {section.paragraphs?.map(paragraph => (
                <Text key={paragraph} style={styles.body}>{paragraph}</Text>
              ))}
              {section.bullets?.map(bullet => (
                <View key={bullet} style={styles.bulletRow}>
                  <Text style={styles.bulletMark}>•</Text>
                  <Text style={styles.bulletText}>{bullet}</Text>
                </View>
              ))}
              {section.callout ? (
                <View style={styles.callout}>
                  <Text style={styles.calloutText}>{section.callout}</Text>
                </View>
              ) : null}
            </View>
          ))}

          {props.links?.length ? (
            <View style={styles.linkSection}>
              <Text style={styles.eyebrow}>KEEP READING</Text>
              <View style={styles.linkWrap}>
                {props.links.map(link => (
                  <Link key={link.href} href={link.href as any} asChild>
                    <Pressable style={styles.linkButton}>
                      <Text style={styles.linkText}>{link.label}</Text>
                    </Pressable>
                  </Link>
                ))}
              </View>
            </View>
          ) : null}

          {props.sources?.length ? (
            <View style={styles.sourceSection}>
              <Text style={styles.eyebrow}>OFFICIAL SOURCES</Text>
              {props.sources.map(source => <Link key={source.url} href={source.url as any} target="_blank" asChild><Pressable accessibilityRole="link" style={styles.sourceRow}><Text style={styles.sourceText}>{source.label}</Text><Text style={styles.sourceArrow}>→</Text></Pressable></Link>)}
            </View>
          ) : null}
        </View>

        <PublicFooter />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#FAFAF8" },
  pageContent: { minHeight: "100%" },
  hero: { width: "100%", maxWidth: 920, alignSelf: "center", paddingHorizontal: 24, paddingTop: 82, paddingBottom: 62 },
  heroCompact: { paddingHorizontal: 18, paddingTop: 50, paddingBottom: 44 },
  eyebrow: { marginBottom: 14, color: "#3B6D11", fontSize: 12, lineHeight: 17, fontWeight: "800", letterSpacing: 1.2 },
  heroTitle: { maxWidth: 880, color: "#1A1915", fontSize: 52, lineHeight: 57, fontWeight: "800", letterSpacing: -2.1 },
  heroTitleCompact: { fontSize: 37, lineHeight: 42, letterSpacing: -1.2 },
  intro: { maxWidth: 800, marginTop: 24, color: "#5F5D57", fontSize: 19, lineHeight: 31 },
  reviewed: { marginTop: 18, color: "#8A8880", fontSize: 12, fontWeight: "700" },
  byline: { maxWidth: 760, marginTop: 8, color: "#8A8880", fontSize: 12, lineHeight: 19 },
  article: { width: "100%", maxWidth: 920, alignSelf: "center", paddingHorizontal: 24, paddingBottom: 80 },
  section: { paddingVertical: 46, borderTopWidth: 1, borderTopColor: "#E5E3DA" },
  sectionTitle: { maxWidth: 820, marginBottom: 20, color: "#1A1915", fontSize: 34, lineHeight: 40, fontWeight: "800", letterSpacing: -1.1 },
  sectionTitleCompact: { fontSize: 29, lineHeight: 35 },
  body: { maxWidth: 800, marginBottom: 17, color: "#5F5D57", fontSize: 16, lineHeight: 28 },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  bulletMark: { color: "#3B6D11", fontSize: 16, lineHeight: 25, fontWeight: "800" },
  bulletText: { flex: 1, color: "#5F5D57", fontSize: 15, lineHeight: 25 },
  callout: { marginTop: 16, padding: 20, borderLeftWidth: 4, borderLeftColor: "#3B6D11", borderRadius: 10, backgroundColor: "#EEF4E9" },
  calloutText: { color: "#35452A", fontSize: 14, lineHeight: 23, fontWeight: "600" },
  linkSection: { paddingTop: 48, borderTopWidth: 1, borderTopColor: "#E5E3DA" },
  linkWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  linkButton: { minHeight: 44, paddingHorizontal: 15, borderWidth: 1, borderColor: "#D3D1C7", borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  linkText: { color: "#27500A", fontSize: 13, fontWeight: "700" },
  sourceSection: { marginTop: 48, paddingTop: 48, borderTopWidth: 1, borderTopColor: "#E5E3DA" },
  sourceRow: { minHeight: 54, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, borderBottomWidth: 1, borderBottomColor: "#E5E3DA" },
  sourceText: { flex: 1, color: "#27500A", fontSize: 14, lineHeight: 21, fontWeight: "700" },
  sourceArrow: { color: "#3B6D11", fontSize: 18, fontWeight: "800" },
});
