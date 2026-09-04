import { Link, useLocalSearchParams } from "expo-router";
import PublicHeader from "../../components/public/PublicHeader";
import Head from "expo-router/head";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { usePublicCompact } from "../../hooks/usePublicCompact";
import JsonLd from "../../components/public/JsonLd";
import { howToGuides } from "../../lib/howToGuides";

import {
  compliancePageBySlug,
  compliancePages,
  type ComplianceSection,
} from "../../lib/publicCompliancePages";

export async function generateStaticParams() {
  return compliancePages.map((page) => ({ slug: page.slug }));
}

export default function ComplianceDetailPage() {
  const params = useLocalSearchParams<{ slug?: string }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const page = slug ? compliancePageBySlug[slug] : undefined;
  const compact = usePublicCompact();

  if (!page) {
    return (
      <View style={styles.notFoundPage}>
        <Text style={styles.notFoundTitle}>Resource not found.</Text>
        <Link href="/compliance" asChild>
          <Pressable style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>View compliance guides</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  const canonical = `https://weheartpaperwork.com/compliance/${page.slug}`;
  const walkthroughs = howToGuides.filter((guide) => guide.relatedComplianceSlug === page.slug);

  return (
    <>
      <Head>
        <title>{page.metaTitle}</title>
        <meta name="description" content={page.metaDescription} />
        <link rel="canonical" href={canonical} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={page.metaTitle} />
        <meta property="og:description" content={page.metaDescription} />
        <meta property="og:url" content={canonical} />
      </Head>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: page.title,
          description: page.metaDescription,
          mainEntityOfPage: canonical,
          dateModified: new Date(page.lastReviewed).toISOString().slice(0, 10),
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
          <View style={styles.breadcrumbs}>
            <Link href="/" asChild>
              <Pressable><Text style={styles.breadcrumbLink}>Home</Text></Pressable>
            </Link>
            <Text style={styles.breadcrumbSeparator}>/</Text>
            <Link href="/compliance" asChild>
              <Pressable><Text style={styles.breadcrumbLink}>Compliance guides</Text></Pressable>
            </Link>
          </View>

          <Text style={styles.eyebrow}>{page.eyebrow}</Text>
          <Text accessibilityRole="header" style={[styles.heroTitle, compact && styles.heroTitleCompact]}>
            {page.title}
          </Text>
          <Text style={styles.heroDescription}>{page.shortVersion}</Text>

          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Last reviewed</Text>
            <Text style={styles.reviewDate}>{page.lastReviewed}</Text>
          </View>
          <Text style={styles.byline}>
            Written and maintained by We Heart Paperwork, built by a trucking company owner in Yakima, Washington.
          </Text>

          {page.toolLink ? (
            <Link href={page.toolLink.href} asChild>
              <Pressable style={styles.toolButton}>
                <Text style={styles.toolButtonText}>{page.toolLink.label}</Text>
              </Pressable>
            </Link>
          ) : null}
        </View>

        {page.maintenanceNote ? (
          <View style={styles.noticeOuter}>
            <View style={styles.noticeCard}>
              <Text style={styles.noticeEyebrow}>CURRENT / TIME-SENSITIVE NOTE</Text>
              <Text style={styles.noticeText}>{page.maintenanceNote}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.article}>
          {page.sections.map((section) => (
            <ArticleSection key={section.heading} section={section} compact={compact} />
          ))}

          <View style={styles.faqSection}>
            <Text style={styles.eyebrow}>COMMON QUESTIONS</Text>
            <Text style={[styles.sectionTitle, compact && styles.sectionTitleCompact]}>
              Straight answers.
            </Text>

            <View style={styles.faqList}>
              {page.faqs.map((faq, index) => (
                <View
                  key={faq.question}
                  style={[
                    styles.faqItem,
                    index === page.faqs.length - 1 && styles.faqItemLast,
                  ]}
                >
                  <Text style={styles.faqQuestion}>{faq.question}</Text>
                  <Text style={styles.faqAnswer}>{faq.answer}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.sourceSection}>
            <Text style={styles.eyebrow}>OFFICIAL SOURCES</Text>
            <Text style={styles.sourceIntro}>
              These pages are general information, not legal advice. Regulations,
              agency systems, fees, and enforcement practices can change. Use the
              official sources below to verify current requirements for your operation.
            </Text>

            <View style={styles.sourceList}>
              {page.sources.map((source) => <Link key={source.url} href={source.url as any} target="_blank" asChild><Pressable accessibilityRole="link" style={styles.sourceRow}><Text style={styles.sourceText}>{source.label}</Text><Text style={styles.sourceArrow}>→</Text></Pressable></Link>)}
            </View>
          </View>

          {walkthroughs.length ? <View style={styles.relatedSection}><Text style={styles.eyebrow}>READY TO DO THE WORK?</Text><View style={styles.relatedWrap}>{walkthroughs.map(guide => <Link key={guide.slug} href={`/how-to/${guide.slug}` as any} asChild><Pressable style={styles.relatedButton}><Text style={styles.relatedButtonText}>{guide.title} →</Text></Pressable></Link>)}</View></View> : null}

          <View style={styles.relatedSection}>
            <Text style={styles.eyebrow}>RELATED GUIDES</Text>
            <View style={styles.relatedWrap}>
              {page.related.map((item) => (
                <Link
                  key={item.slug}
                  href={{ pathname: "/compliance/[slug]", params: { slug: item.slug } }}
                  asChild
                >
                  <Pressable style={styles.relatedButton}>
                    <Text style={styles.relatedButtonText}>{item.label}</Text>
                  </Pressable>
                </Link>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.finalSection}>
          <View style={[styles.finalCard, compact && styles.finalCardCompact]}>
            <View style={styles.finalCopy}>
              <Text style={styles.finalEyebrow}>WE HEART PAPERWORK</Text>
              <Text style={[styles.finalTitle, compact && styles.finalTitleCompact]}>
                Know what is coming before it becomes a scramble.
              </Text>
              <Text style={styles.finalDescription}>
                Keep recurring company and driver compliance work together in one clear dashboard.
              </Text>
            </View>

            <Link href="/pricing" asChild>
              <Pressable style={styles.finalButton}>
                <Text style={styles.finalButtonText}>See pricing</Text>
              </Pressable>
            </Link>
          </View>
        </View>

        <Footer compact={compact} />
      </ScrollView>
    </>
  );
}

function ArticleSection({
  section,
  compact,
}: {
  section: ComplianceSection;
  compact: boolean;
}) {
  return (
    <View style={styles.articleSection}>
      <Text style={[styles.sectionTitle, compact && styles.sectionTitleCompact]}>
        {section.heading}
      </Text>

      {section.paragraphs?.map((paragraph) => (
        <Text key={paragraph} style={styles.bodyText}>{paragraph}</Text>
      ))}

      {section.bullets?.map((bullet) => (
        <View key={bullet} style={styles.bulletRow}>
          <Text style={styles.bulletMark}>•</Text>
          <Text style={styles.bulletText}>{bullet}</Text>
        </View>
      ))}

      {section.table ? (
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            {section.table.headers.map((header) => (
              <View key={header} style={styles.tableCell}>
                <Text style={styles.tableHeaderText}>{header}</Text>
              </View>
            ))}
          </View>

          {section.table.rows.map((row, rowIndex) => (
            <View
              key={`${section.heading}-${rowIndex}`}
              style={[
                styles.tableRow,
                rowIndex === section.table!.rows.length - 1 && styles.tableRowLast,
              ]}
            >
              {row.map((cell, cellIndex) => (
                <View key={`${rowIndex}-${cellIndex}`} style={styles.tableCell}>
                  <Text style={cellIndex === 0 ? styles.tableFirstText : styles.tableText}>
                    {cell}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : null}

      {section.callout ? (
        <View style={styles.callout}>
          <Text style={styles.calloutText}>{section.callout}</Text>
        </View>
      ) : null}
    </View>
  );
}


function Footer({ compact }: { compact: boolean }) {
  return (
    <>
      <View style={[styles.footer, compact && styles.footerCompact]}>
        <View>
          <Text style={styles.footerBrand}>We Heart Paperwork</Text>
          <Text style={styles.footerDescription}>Practical compliance organization for trucking companies.</Text>
        </View>
        <View style={styles.footerLinks}>
          <Link href="/features" asChild><Pressable><Text style={styles.footerLink}>Features</Text></Pressable></Link>
          <Link href="/pricing" asChild><Pressable><Text style={styles.footerLink}>Pricing</Text></Pressable></Link>
          <Link href="/compliance" asChild><Pressable><Text style={styles.footerLink}>Compliance Guides</Text></Pressable></Link>
          <Link href="/tools/mcs-150-due-date-calculator" asChild><Pressable><Text style={styles.footerLink}>Free MCS-150 Tool</Text></Pressable></Link>
          <Link href="/about" asChild><Pressable><Text style={styles.footerLink}>About</Text></Pressable></Link>
          <Link href="/support" asChild><Pressable><Text style={styles.footerLink}>Support</Text></Pressable></Link>
          <Link href="/privacy" asChild><Pressable><Text style={styles.footerLink}>Privacy</Text></Pressable></Link>
        </View>
      </View>
      <View style={[styles.legal, compact && styles.legalCompact]}>
        <Text style={styles.legalText}>{"\u00A9"} 2026 We Heart Paperwork</Text>
        <Text style={styles.legalText}>General information only. We Heart Paperwork does not provide legal advice or guarantee regulatory compliance.</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#FAFAF8" },
  pageContent: { minHeight: "100%" },
  notFoundPage: { flex: 1, minHeight: 500, alignItems: "center", justifyContent: "center", gap: 24, backgroundColor: "#FAFAF8" },
  notFoundTitle: { color: "#1A1915", fontSize: 32, fontWeight: "800" },
  header: { borderBottomWidth: 1, borderBottomColor: "#E5E3DA", backgroundColor: "#FAFAF8" },
  headerInner: { width: "100%", maxWidth: 1120, alignSelf: "center", minHeight: 72, paddingHorizontal: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 20 },
  headerInnerCompact: { minHeight: 68, paddingHorizontal: 18, gap: 12 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  logo: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#27500A" },
  logoText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  brandName: { color: "#1A1915", fontSize: 16, fontWeight: "700" },
  headerLinks: { flexDirection: "row", alignItems: "center", gap: 20 },
  headerLinksCompact: { gap: 12 },
  headerLink: { color: "#706E68", fontSize: 14, fontWeight: "500" },
  headerLinkActive: { color: "#27500A", fontWeight: "800" },
  loginButton: { minHeight: 40, paddingHorizontal: 16, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#27500A" },
  loginButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  hero: { width: "100%", maxWidth: 920, alignSelf: "center", paddingHorizontal: 24, paddingTop: 72, paddingBottom: 72 },
  heroCompact: { paddingHorizontal: 18, paddingTop: 48, paddingBottom: 52 },
  breadcrumbs: { marginBottom: 34, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  breadcrumbLink: { color: "#706E68", fontSize: 12, fontWeight: "600" },
  breadcrumbSeparator: { color: "#B0AEA7", fontSize: 12 },
  eyebrow: { marginBottom: 14, color: "#3B6D11", fontSize: 12, lineHeight: 17, fontWeight: "800", letterSpacing: 1.2 },
  heroTitle: { maxWidth: 880, color: "#1A1915", fontSize: 54, lineHeight: 58, fontWeight: "800", letterSpacing: -2.3 },
  heroTitleCompact: { fontSize: 38, lineHeight: 42, letterSpacing: -1.4 },
  heroDescription: { maxWidth: 800, marginTop: 24, color: "#5F5D57", fontSize: 19, lineHeight: 31 },
  reviewRow: { marginTop: 22, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reviewLabel: { color: "#8A8880", fontSize: 12, fontWeight: "600" },
  reviewDate: { color: "#5F5D57", fontSize: 12, fontWeight: "800" },
  byline: { maxWidth: 760, marginTop: 8, color: "#8A8880", fontSize: 12, lineHeight: 19 },
  toolButton: { alignSelf: "flex-start", minHeight: 50, marginTop: 28, paddingHorizontal: 20, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#27500A" },
  toolButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  primaryButton: { minHeight: 50, paddingHorizontal: 20, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#27500A" },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  noticeOuter: { width: "100%", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#E9D0A8", backgroundColor: "#FAEEDA" },
  noticeCard: { width: "100%", maxWidth: 920, alignSelf: "center", paddingHorizontal: 24, paddingVertical: 28 },
  noticeEyebrow: { marginBottom: 8, color: "#854F0B", fontSize: 11, fontWeight: "800", letterSpacing: 1.1 },
  noticeText: { color: "#6E4814", fontSize: 14, lineHeight: 23 },
  article: { width: "100%", maxWidth: 920, alignSelf: "center", paddingHorizontal: 24, paddingBottom: 30 },
  articleSection: { paddingVertical: 52, borderBottomWidth: 1, borderBottomColor: "#E5E3DA" },
  sectionTitle: { maxWidth: 820, marginBottom: 22, color: "#1A1915", fontSize: 34, lineHeight: 39, fontWeight: "800", letterSpacing: -1.2 },
  sectionTitleCompact: { fontSize: 29, lineHeight: 34, letterSpacing: -0.8 },
  bodyText: { maxWidth: 800, marginBottom: 17, color: "#5F5D57", fontSize: 16, lineHeight: 28 },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  bulletMark: { color: "#3B6D11", fontSize: 16, fontWeight: "800", lineHeight: 25 },
  bulletText: { flex: 1, color: "#5F5D57", fontSize: 15, lineHeight: 25 },
  table: { marginTop: 12, overflow: "hidden", borderWidth: 1, borderColor: "#E5E3DA", borderRadius: 16, backgroundColor: "#FFFFFF" },
  tableHeaderRow: { flexDirection: "row", backgroundColor: "#F4F3EE", borderBottomWidth: 1, borderBottomColor: "#E5E3DA" },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#E5E3DA" },
  tableRowLast: { borderBottomWidth: 0 },
  tableCell: { flex: 1, minWidth: 0, paddingHorizontal: 14, paddingVertical: 13 },
  tableHeaderText: { color: "#1A1915", fontSize: 12, lineHeight: 18, fontWeight: "800" },
  tableFirstText: { color: "#1A1915", fontSize: 13, lineHeight: 19, fontWeight: "800" },
  tableText: { color: "#5F5D57", fontSize: 13, lineHeight: 19 },
  callout: { marginTop: 20, padding: 20, borderLeftWidth: 4, borderLeftColor: "#3B6D11", borderRadius: 10, backgroundColor: "#EEF4E9" },
  calloutText: { color: "#35452A", fontSize: 14, lineHeight: 23, fontWeight: "600" },
  faqSection: { paddingTop: 72, paddingBottom: 34 },
  faqList: { marginTop: 24, borderTopWidth: 1, borderTopColor: "#E5E3DA" },
  faqItem: { paddingVertical: 26, borderBottomWidth: 1, borderBottomColor: "#E5E3DA" },
  faqItemLast: { borderBottomWidth: 0 },
  faqQuestion: { color: "#1A1915", fontSize: 18, fontWeight: "800" },
  faqAnswer: { maxWidth: 800, marginTop: 9, color: "#5F5D57", fontSize: 15, lineHeight: 25 },
  sourceSection: { paddingVertical: 54, borderTopWidth: 1, borderTopColor: "#E5E3DA" },
  sourceIntro: { maxWidth: 800, color: "#706E68", fontSize: 14, lineHeight: 23 },
  sourceList: { marginTop: 22, borderTopWidth: 1, borderTopColor: "#E5E3DA" },
  sourceRow: { minHeight: 54, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, borderBottomWidth: 1, borderBottomColor: "#E5E3DA" },
  sourceText: { flex: 1, color: "#27500A", fontSize: 14, lineHeight: 21, fontWeight: "700" },
  sourceArrow: { color: "#3B6D11", fontSize: 18, fontWeight: "800" },
  relatedSection: { paddingVertical: 48, borderTopWidth: 1, borderTopColor: "#E5E3DA" },
  relatedWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  relatedButton: { minHeight: 42, paddingHorizontal: 14, borderWidth: 1, borderColor: "#D3D1C7", borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  relatedButtonText: { color: "#27500A", fontSize: 13, fontWeight: "700" },
  finalSection: { width: "100%", maxWidth: 1120, alignSelf: "center", paddingHorizontal: 24, paddingVertical: 90 },
  finalCard: { padding: 40, borderRadius: 24, backgroundColor: "#1A1915", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 30 },
  finalCardCompact: { padding: 30, flexDirection: "column", alignItems: "flex-start" },
  finalCopy: { flex: 1 },
  finalEyebrow: { marginBottom: 12, color: "#B8D5A2", fontSize: 12, fontWeight: "800", letterSpacing: 1.2 },
  finalTitle: { color: "#FFFFFF", fontSize: 38, lineHeight: 42, fontWeight: "800", letterSpacing: -1.4 },
  finalTitleCompact: { fontSize: 30, lineHeight: 34 },
  finalDescription: { marginTop: 10, maxWidth: 650, color: "#D5D3CC", fontSize: 14, lineHeight: 22 },
  finalButton: { minHeight: 50, paddingHorizontal: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  finalButtonText: { color: "#27500A", fontSize: 14, fontWeight: "800" },
  footer: { width: "100%", maxWidth: 1120, alignSelf: "center", paddingHorizontal: 24, paddingTop: 50, paddingBottom: 32, borderTopWidth: 1, borderTopColor: "#E5E3DA", flexDirection: "row", justifyContent: "space-between", gap: 30 },
  footerCompact: { flexDirection: "column" },
  footerBrand: { color: "#1A1915", fontSize: 16, fontWeight: "800" },
  footerDescription: { marginTop: 8, color: "#706E68", fontSize: 13 },
  footerLinks: { flexDirection: "row", flexWrap: "wrap", gap: 20 },
  footerLink: { color: "#706E68", fontSize: 13 },
  legal: { width: "100%", maxWidth: 1120, alignSelf: "center", paddingHorizontal: 24, paddingTop: 24, paddingBottom: 34, borderTopWidth: 1, borderTopColor: "#E5E3DA", flexDirection: "row", justifyContent: "space-between", gap: 30 },
  legalCompact: { flexDirection: "column", gap: 10 },
  legalText: { maxWidth: 650, color: "#8A8880", fontSize: 11, lineHeight: 17 },
});
