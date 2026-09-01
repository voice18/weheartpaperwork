import { Link, useLocalSearchParams } from "expo-router";
import Head from "expo-router/head";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import PublicFooter from "../../components/public/PublicFooter";
import PublicHeader from "../../components/public/PublicHeader";
import JsonLd from "../../components/public/JsonLd";
import { usePublicCompact } from "../../hooks/usePublicCompact";
import { howToGuideBySlug, howToGuides } from "../../lib/howToGuides";
import { howToConnections } from "../../lib/howToConnections";

export async function generateStaticParams() {
  return howToGuides.map(guide => ({ slug: guide.slug }));
}

export default function HowToDetailPage() {
  const params = useLocalSearchParams<{ slug?: string }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const guide = slug ? howToGuideBySlug[slug] : undefined;
  const compact = usePublicCompact();

  if (!guide) return <View style={styles.missing}><Text>How-to guide not found.</Text></View>;
  const canonical = `https://weheartpaperwork.com/how-to/${guide.slug}`;
  const connections = howToConnections[guide.slug];

  return <>
    <Head><title>{guide.metaTitle}</title><meta name="description" content={guide.metaDescription} /><link rel="canonical" href={canonical} /></Head>
    <JsonLd data={{ "@context": "https://schema.org", "@type": "HowTo", name: guide.title, description: guide.metaDescription, step: guide.steps.map(step => ({ "@type": "HowToStep", name: step.title, text: step.text })) }} />
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
      <PublicHeader />
      <View style={[styles.hero, compact && styles.heroCompact]}>
        <Text style={styles.eyebrow}>{guide.category}</Text>
        <Text accessibilityRole="header" style={[styles.title, compact && styles.titleCompact]}>{guide.title}</Text>
        <Text style={styles.intro}>{guide.intro}</Text>
        <View style={styles.facts}><Text style={styles.fact}>TIME: {guide.time}</Text><Text style={styles.fact}>COST: {guide.cost}</Text></View>
        <Text style={styles.reviewed}>Last reviewed {guide.reviewed}</Text>
      </View>

      <View style={styles.article}>
        <View style={styles.section}><Text style={styles.sectionTitle}>Before you start</Text>{guide.gather.map(item => <Bullet key={item} text={item} />)}{connections?.prerequisites?.length ? <View style={styles.prerequisites}><Text style={styles.prerequisiteTitle}>Need help with a prerequisite?</Text>{connections.prerequisites.map(item => <Link key={item.href} href={item.href as any} asChild><Pressable style={styles.prerequisiteLink}><Text style={styles.prerequisiteText}>{item.label} →</Text></Pressable></Link>)}</View> : null}</View>
        <View style={styles.section}><Text style={styles.sectionTitle}>Get it done</Text>{guide.steps.map((step, index) => <View key={step.title} style={styles.step}><Text style={styles.stepNumber}>{String(index + 1).padStart(2, "0")}</Text><View style={styles.stepCopy}><Text style={styles.stepTitle}>{step.title}</Text><Text style={styles.body}>{step.text}</Text>{step.bullets?.map(item => <Bullet key={item} text={item} />)}</View></View>)}</View>

        {guide.primaryAction || guide.alternateActions?.length ? <View style={styles.actionBox}>
          <Text style={styles.actionEyebrow}>GO TO THE RIGHT PLACE</Text>
          {guide.primaryAction ? <ExternalButton label={guide.primaryAction.label} url={guide.primaryAction.url} primary /> : null}
          {guide.alternateActions?.map(action => <View key={action.url} style={styles.altAction}><ExternalButton label={action.label} url={action.url} />{action.note ? <Text style={styles.note}>{action.note}</Text> : null}</View>)}
        </View> : null}

        {connections?.stuck ? <View style={styles.stuckBox}><Text style={styles.stuckTitle}>Where people usually get stuck</Text><Text style={styles.stuckText}>{connections.stuck}</Text>{connections.stuckLink ? <ExternalButton label={connections.stuckLink.label} url={connections.stuckLink.url} onLight /> : null}</View> : null}

        <View style={styles.section}><Text style={styles.sectionTitle}>What to save when you finish</Text>{guide.keep.map(item => <Bullet key={item} text={item} />)}<View style={styles.callout}><Text style={styles.calloutText}>{guide.caution}</Text></View></View>

        {guide.generator ? <View style={styles.generator}><Text style={styles.generatorTag}>DOCUMENT ENGINE · {guide.generator.status === "available" ? "AVAILABLE" : "PLANNED"}</Text><Text style={styles.generatorTitle}>{guide.generator.title}</Text><Text style={styles.body}>{guide.generator.description}</Text><Text style={styles.generatorNote}>{guide.generator.status === "available" ? "The document tool lives on the website so the compliance app can stay focused on dates, status, and reminders." : "The guide works now. This space is reserved for the future form-to-PDF tool without adding complexity to the compliance app."}</Text></View> : null}

        <View style={styles.bridge}><Text style={styles.bridgeTitle}>Filing it is the easy part. Remembering the next one is what gets people.</Text><Text style={styles.bridgeText}>When the document is finished, save the completion date and next deadline in We Heart Paperwork.</Text><View style={styles.bridgeActions}><Link href="/pricing" asChild><Pressable style={styles.primaryButton}><Text style={styles.primaryText}>See pricing</Text></Pressable></Link><Link href={`/compliance/${guide.relatedComplianceSlug}` as any} asChild><Pressable style={styles.secondaryButton}><Text style={styles.secondaryText}>Understand the requirement</Text></Pressable></Link></View></View>

        <View style={styles.sources}><Text style={styles.eyebrow}>OFFICIAL SOURCES</Text>{guide.sources.map(source => <Link key={source.url} href={source.url as any} target="_blank" asChild><Pressable accessibilityRole="link" style={styles.sourceRow}><Text style={styles.sourceText}>{source.label}</Text><Text style={styles.sourceArrow}>→</Text></Pressable></Link>)}</View>
      </View>
      <PublicFooter />
    </ScrollView>
  </>;
}

function Bullet({ text }: { text: string }) { return <View style={styles.bullet}><Text style={styles.bulletMark}>•</Text><Text style={styles.bulletText}>{text}</Text></View>; }
function ExternalButton({ label, url, primary, onLight }: { label: string; url: string; primary?: boolean; onLight?: boolean }) { return <Link href={url as any} target="_blank" asChild><Pressable accessibilityRole="link" style={primary ? styles.externalPrimary : onLight ? styles.externalOnLight : styles.externalSecondary}><Text style={primary ? styles.externalPrimaryText : onLight ? styles.externalOnLightText : styles.externalSecondaryText}>{label} →</Text></Pressable></Link>; }

const styles = StyleSheet.create({
  page:{flex:1,backgroundColor:"#FAFAF8"},pageContent:{minHeight:"100%"},missing:{padding:40},hero:{width:"100%",maxWidth:920,alignSelf:"center",paddingHorizontal:24,paddingTop:82,paddingBottom:60},heroCompact:{paddingHorizontal:18,paddingTop:50,paddingBottom:42},eyebrow:{marginBottom:14,color:"#3B6D11",fontSize:12,lineHeight:17,fontWeight:"800",letterSpacing:1.2},title:{maxWidth:880,color:"#1A1915",fontSize:52,lineHeight:57,fontWeight:"800",letterSpacing:-2.1},titleCompact:{fontSize:37,lineHeight:42,letterSpacing:-1.2},intro:{maxWidth:800,marginTop:24,color:"#5F5D57",fontSize:19,lineHeight:31},facts:{marginTop:24,flexDirection:"row",flexWrap:"wrap",gap:10},fact:{paddingHorizontal:11,paddingVertical:7,borderRadius:8,backgroundColor:"#EEF4E9",color:"#27500A",fontSize:11,fontWeight:"800"},reviewed:{marginTop:15,color:"#8A8880",fontSize:12},article:{width:"100%",maxWidth:920,alignSelf:"center",paddingHorizontal:24,paddingBottom:80},section:{paddingVertical:44,borderTopWidth:1,borderTopColor:"#E5E3DA"},sectionTitle:{marginBottom:22,color:"#1A1915",fontSize:32,lineHeight:38,fontWeight:"800"},bullet:{flexDirection:"row",alignItems:"flex-start",gap:10,marginBottom:11},bulletMark:{color:"#3B6D11",fontSize:17,lineHeight:25,fontWeight:"800"},bulletText:{flex:1,color:"#5F5D57",fontSize:15,lineHeight:25},prerequisites:{marginTop:20,padding:18,borderRadius:12,backgroundColor:"#EEF4E9"},prerequisiteTitle:{marginBottom:8,color:"#1A1915",fontSize:14,fontWeight:"800"},prerequisiteLink:{minHeight:42,justifyContent:"center"},prerequisiteText:{color:"#27500A",fontSize:14,lineHeight:20,fontWeight:"700"},step:{paddingVertical:25,flexDirection:"row",gap:20,borderTopWidth:1,borderTopColor:"#E5E3DA"},stepNumber:{color:"#3B6D11",fontSize:12,fontWeight:"800"},stepCopy:{flex:1},stepTitle:{marginBottom:8,color:"#1A1915",fontSize:20,lineHeight:26,fontWeight:"800"},body:{color:"#5F5D57",fontSize:15,lineHeight:25},actionBox:{padding:24,borderRadius:18,backgroundColor:"#1A1915"},actionEyebrow:{marginBottom:15,color:"#B8D5A2",fontSize:11,fontWeight:"800",letterSpacing:1.1},externalPrimary:{alignSelf:"flex-start",paddingHorizontal:17,paddingVertical:13,borderRadius:10,backgroundColor:"#FFFFFF"},externalPrimaryText:{color:"#27500A",fontSize:14,fontWeight:"800"},externalSecondary:{alignSelf:"flex-start",marginTop:14,paddingHorizontal:15,paddingVertical:11,borderWidth:1,borderColor:"#77736C",borderRadius:10},externalSecondaryText:{color:"#FFFFFF",fontSize:13,fontWeight:"700"},externalOnLight:{alignSelf:"flex-start",minHeight:44,marginTop:16,paddingHorizontal:16,paddingVertical:11,borderWidth:1,borderColor:"#B99B69",borderRadius:10,justifyContent:"center",backgroundColor:"#FFFFFF"},externalOnLightText:{color:"#27500A",fontSize:13,fontWeight:"800"},altAction:{marginTop:6},note:{maxWidth:700,marginTop:9,color:"#BBB8B0",fontSize:12,lineHeight:19},stuckBox:{marginVertical:38,padding:22,borderWidth:1,borderColor:"#E2D2B7",borderRadius:14,backgroundColor:"#FFF8EC"},stuckTitle:{marginBottom:9,color:"#3F321D",fontSize:20,lineHeight:25,fontWeight:"800"},stuckText:{color:"#604F34",fontSize:14,lineHeight:23},callout:{marginTop:18,padding:20,borderLeftWidth:4,borderLeftColor:"#A85F06",borderRadius:10,backgroundColor:"#F7EEDD"},calloutText:{color:"#60430F",fontSize:14,lineHeight:23,fontWeight:"600"},generator:{marginBottom:44,padding:24,borderWidth:1,borderStyle:"dashed",borderColor:"#B8B5AA",borderRadius:16,backgroundColor:"#FFFFFF"},generatorTag:{color:"#706E68",fontSize:10,fontWeight:"800",letterSpacing:1.2},generatorTitle:{marginTop:10,marginBottom:9,color:"#1A1915",fontSize:23,fontWeight:"800"},generatorNote:{marginTop:13,color:"#8A8880",fontSize:12,lineHeight:19},bridge:{marginBottom:44,padding:28,borderRadius:18,backgroundColor:"#EEF4E9"},bridgeTitle:{maxWidth:760,color:"#1A1915",fontSize:27,lineHeight:34,fontWeight:"800"},bridgeText:{maxWidth:700,marginTop:12,color:"#5F5D57",fontSize:15,lineHeight:25},bridgeActions:{marginTop:20,flexDirection:"row",flexWrap:"wrap",gap:10},primaryButton:{paddingHorizontal:17,paddingVertical:13,borderRadius:10,backgroundColor:"#27500A"},primaryText:{color:"#FFFFFF",fontSize:13,fontWeight:"800"},secondaryButton:{paddingHorizontal:17,paddingVertical:13,borderWidth:1,borderColor:"#B6CBA4",borderRadius:10,backgroundColor:"#FFFFFF"},secondaryText:{color:"#27500A",fontSize:13,fontWeight:"800"},sources:{paddingTop:40,borderTopWidth:1,borderTopColor:"#E5E3DA"},sourceRow:{minHeight:54,paddingVertical:12,flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:16,borderBottomWidth:1,borderBottomColor:"#E5E3DA"},sourceText:{flex:1,color:"#27500A",fontSize:14,lineHeight:21,fontWeight:"700"},sourceArrow:{color:"#3B6D11",fontSize:18,fontWeight:"800"}
});
