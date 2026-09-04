import { Link } from "expo-router";
import Head from "expo-router/head";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import PublicFooter from "../../components/public/PublicFooter";
import PublicHeader from "../../components/public/PublicHeader";
import { usePublicCompact } from "../../hooks/usePublicCompact";
import { howToGuideBySlug } from "../../lib/howToGuides";
import { openStaticTool } from "../../lib/openStaticTool";

const groups = [
  {
    number: "01",
    eyebrow: "COMPANY",
    title: "Set up or manage your company",
    description: "Start at the top when you are new. After setup, open only the filing or renewal you need.",
    ordered: true,
    slugs: ["set-up-login-gov", "update-mcs-150-motus", "file-boc-3", "file-ucr-registration", "file-form-2290", "file-ifta-quarterly-return", "renew-irp-registration"],
  },
  {
    number: "02",
    eyebrow: "DRIVER ONBOARDING",
    title: "Add a driver",
    description: "The records and checks that belong to hiring and qualification before the recurring calendar begins.",
    ordered: true,
    slugs: ["set-up-clearinghouse", "enroll-drug-alcohol-consortium", "get-driver-mvr", "build-driver-qualification-file"],
  },
  {
    number: "03",
    eyebrow: "ONGOING DRIVER COMPLIANCE",
    title: "Keep a driver current",
    description: "The driver work that comes back on a date instead of ending after onboarding.",
    ordered: false,
    slugs: ["complete-annual-mvr-review", "run-annual-clearinghouse-query", "renew-dot-medical-certification"],
  },
  {
    number: "04",
    eyebrow: "FLEET",
    title: "Manage trucks and trailers",
    description: "Vehicle-specific inspection and registration work, kept separate by unit.",
    ordered: false,
    slugs: ["complete-annual-dot-inspection", "renew-irp-registration", "file-form-2290"],
  },
];

export default function HowToIndexPage() {
  const compact = usePublicCompact();
  return <>
    <Head><title>How to Handle Trucking Compliance Paperwork</title><meta name="description" content="Clear, practical walkthroughs for company setup, driver onboarding, recurring driver compliance, trucks, trailers, and audit preparation." /><link rel="canonical" href="https://weheartpaperwork.com/how-to" /></Head>
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
      <PublicHeader />
      <View style={[styles.hero, compact && styles.heroCompact]}>
        <Text style={styles.eyebrow}>HOW TO GET IT DONE</Text>
        <Text accessibilityRole="header" style={[styles.title, compact && styles.titleCompact]}>Start with the job in front of you.</Text>
        <Text style={[styles.intro, compact && styles.introCompact]}>You do not need to learn everything at once. Pick the section that matches what you are doing, then follow one clear walkthrough.</Text>
      </View>

      <View style={[styles.groupList, compact && styles.groupListCompact]}>
        {groups.map(group => <View key={group.title} style={[styles.group, compact && styles.groupCompact]}>
          <View style={styles.groupHeading}>
            <Text style={styles.groupNumber}>{group.number}</Text>
            <View style={styles.groupHeadingCopy}><Text style={styles.eyebrow}>{group.eyebrow}</Text><Text style={[styles.groupTitle, compact && styles.groupTitleCompact]}>{group.title}</Text><Text style={styles.groupDescription}>{group.description}</Text></View>
          </View>
          <View style={styles.guideList}>{group.slugs.map((slug, index) => {
            const guide = howToGuideBySlug[slug];
            if (!guide) return null;
            return <Link key={slug} href={`/how-to/${slug}` as any} asChild><Pressable accessibilityRole="link" style={({ pressed }) => [styles.guideRow, pressed && styles.pressed]}>
              <Text style={styles.guideNumber}>{group.ordered ? String(index + 1).padStart(2, "0") : "•"}</Text>
              <Text style={styles.guideTitle}>{guide.title}</Text><Text style={styles.guideArrow}>→</Text>
            </Pressable></Link>;
          })}</View>
        </View>)}
      </View>

      <View style={[styles.tools, compact && styles.toolsCompact]}>
        <Text style={styles.eyebrow}>PREPARE FOR AN AUDIT</Text>
        <Text style={[styles.toolsTitle, compact && styles.toolsTitleCompact]}>Check what you have. Build what is missing.</Text>
        <View style={[styles.toolLinks, compact && styles.toolLinksCompact]}>
          <Pressable accessibilityRole="link" onPress={() => openStaticTool("/tools/new-entrant-audit/")} style={styles.toolCard}><Text style={styles.toolTitle}>New Entrant Audit Tool</Text><Text style={styles.toolText}>Walk through the records an auditor may request and leave with an action list.</Text><Text style={styles.toolArrow}>Open the audit tool →</Text></Pressable>
          <Pressable accessibilityRole="link" onPress={() => openStaticTool("/tools/driver-qualification-file/")} style={styles.toolCard}><Text style={styles.toolTitle}>DQ File Builder</Text><Text style={styles.toolText}>Create a DQ file index, carrier-authored forms, and a list of official records still needed.</Text><Text style={styles.toolArrow}>Build a DQ packet →</Text></Pressable>
          <Pressable accessibilityRole="link" onPress={() => openStaticTool("/tools/vehicle-maintenance-file/")} style={styles.toolCard}><Text style={styles.toolTitle}>Maintenance File Builder</Text><Text style={styles.toolText}>Create one organized inspection, repair, and maintenance file for every controlled vehicle.</Text><Text style={styles.toolArrow}>Build a maintenance file →</Text></Pressable>
          <Pressable accessibilityRole="link" onPress={() => openStaticTool("/tools/accident-register/")} style={styles.toolCard}><Text style={styles.toolTitle}>Accident Register Builder</Text><Text style={styles.toolText}>Decide what belongs on the federal register and organize the reports behind every entry.</Text><Text style={styles.toolArrow}>Build an accident register →</Text></Pressable>
        </View>
      </View>
      <View style={[styles.closing, compact && styles.closingCompact]}><Text style={[styles.closingTitle, compact && styles.closingTitleCompact]}>The work is finite. The dates keep moving.</Text><Text style={styles.closingText}>Use the website to get the work done, then use We Heart Paperwork to remember when it comes back.</Text><Link href="/pricing" asChild><Pressable style={styles.cta}><Text style={styles.ctaText}>See pricing</Text></Pressable></Link></View>
      <PublicFooter />
    </ScrollView>
  </>;
}

const styles = StyleSheet.create({
  page:{flex:1,backgroundColor:"#FAFAF8"},pageContent:{minHeight:"100%"},hero:{width:"100%",maxWidth:1080,alignSelf:"center",paddingHorizontal:24,paddingTop:82,paddingBottom:56},heroCompact:{paddingHorizontal:18,paddingTop:48,paddingBottom:38},eyebrow:{marginBottom:10,color:"#3B6D11",fontSize:11,lineHeight:16,fontWeight:"800",letterSpacing:1.15},title:{maxWidth:840,color:"#1A1915",fontSize:54,lineHeight:59,fontWeight:"800",letterSpacing:-2.2},titleCompact:{fontSize:36,lineHeight:41,letterSpacing:-1.2},intro:{maxWidth:720,marginTop:18,color:"#5F5D57",fontSize:18,lineHeight:29},introCompact:{fontSize:16,lineHeight:25},groupList:{width:"100%",maxWidth:1080,alignSelf:"center",paddingHorizontal:24,paddingBottom:84,gap:22},groupListCompact:{paddingHorizontal:18,paddingBottom:58,gap:15},group:{padding:30,borderWidth:1,borderColor:"#E5E3DA",borderRadius:20,backgroundColor:"#FFFFFF"},groupCompact:{padding:20,borderRadius:16},groupHeading:{flexDirection:"row",alignItems:"flex-start",gap:20},groupNumber:{color:"#3B6D11",fontSize:12,fontWeight:"800"},groupHeadingCopy:{flex:1},groupTitle:{color:"#1A1915",fontSize:29,lineHeight:35,fontWeight:"800"},groupTitleCompact:{fontSize:23,lineHeight:29},groupDescription:{maxWidth:760,marginTop:8,color:"#5F5D57",fontSize:14,lineHeight:22},guideList:{marginTop:24,borderTopWidth:1,borderTopColor:"#E5E3DA"},guideRow:{minHeight:58,flexDirection:"row",alignItems:"center",gap:14,borderBottomWidth:1,borderBottomColor:"#E5E3DA"},guideNumber:{width:24,color:"#8A8880",fontSize:10,fontWeight:"800"},guideTitle:{flex:1,color:"#27500A",fontSize:15,lineHeight:21,fontWeight:"700"},guideArrow:{color:"#3B6D11",fontSize:18,fontWeight:"800"},pressed:{opacity:.7},tools:{paddingHorizontal:24,paddingVertical:76,backgroundColor:"#EEF4E9",alignItems:"center"},toolsCompact:{paddingHorizontal:18,paddingVertical:50,alignItems:"stretch"},toolsTitle:{maxWidth:760,textAlign:"center",color:"#1A1915",fontSize:38,lineHeight:44,fontWeight:"800",letterSpacing:-1.2},toolsTitleCompact:{textAlign:"left",fontSize:28,lineHeight:34},toolLinks:{width:"100%",maxWidth:900,marginTop:28,flexDirection:"row",gap:14},toolLinksCompact:{flexDirection:"column"},toolCard:{flex:1,minHeight:190,padding:23,borderWidth:1,borderColor:"#D6E4C9",borderRadius:16,backgroundColor:"#FFFFFF"},toolTitle:{color:"#1A1915",fontSize:20,fontWeight:"800"},toolText:{marginTop:9,color:"#5F5D57",fontSize:14,lineHeight:22},toolArrow:{marginTop:"auto",paddingTop:18,color:"#27500A",fontSize:13,fontWeight:"800"},closing:{paddingHorizontal:24,paddingVertical:76,alignItems:"center"},closingCompact:{paddingHorizontal:20,paddingVertical:52},closingTitle:{maxWidth:680,textAlign:"center",color:"#1A1915",fontSize:30,lineHeight:37,fontWeight:"800"},closingTitleCompact:{fontSize:25,lineHeight:31},closingText:{maxWidth:620,marginTop:13,textAlign:"center",color:"#5F5D57",fontSize:15,lineHeight:25},cta:{minHeight:48,marginTop:22,paddingHorizontal:20,borderRadius:10,alignItems:"center",justifyContent:"center",backgroundColor:"#27500A"},ctaText:{color:"#FFFFFF",fontSize:14,fontWeight:"800"}
});
