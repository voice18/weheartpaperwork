import { Link } from "expo-router";
import Head from "expo-router/head";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import PublicFooter from "../../components/public/PublicFooter";
import PublicHeader from "../../components/public/PublicHeader";
import { usePublicCompact } from "../../hooks/usePublicCompact";
import { openStaticTool } from "../../lib/openStaticTool";

const toolGroups = [
  {
    title: "Start here",
    text: "Find out what applies to your operation before you start building files.",
    tools: [
      { title: "What Paperwork Do I Actually Need?", text: "Answer a few questions and get the federal checklist for your operation, with the regulation behind every item.", href: "/tools/what-do-i-need/", action: "Build my checklist" },
      { title: "New Entrant Audit Tool", text: "Review the records an auditor may request and build a clear action list.", href: "/tools/new-entrant-audit/", action: "Open the audit checklist" },
    ],
  },
  {
    title: "Build and organize required records",
    text: "Create practical files you can save, maintain, and produce when they are requested.",
    tools: [
      { title: "Driver Qualification File Builder", text: "Create a DQ file index, carrier-authored forms, and a list of official records still needed.", href: "/tools/driver-qualification-file/", action: "Build a DQ packet" },
      { title: "Drug and Alcohol Policy Builder", text: "Build the written policy federal law requires for CDL drivers, plus the signed receipt you must keep for each driver.", href: "/tools/drug-alcohol-policy/", action: "Build a policy and receipt" },
      { title: "Vehicle Maintenance File Builder", text: "Build a vehicle identity record, preventive-maintenance schedule, repair log, and annual-inspection history for every unit.", href: "/tools/vehicle-maintenance-file/", action: "Build a maintenance file" },
      { title: "Accident Register Builder", text: "Decide whether an occurrence meets the federal definition, build the three-year register, and organize each supporting file.", href: "/tools/accident-register/", action: "Build an accident register" },
    ],
  },
  {
    title: "Check a filing deadline",
    text: "Use your own carrier information to find the date that applies to you.",
    tools: [
      { title: "MCS-150 Due Date Calculator", text: "Use the last two digits of a USDOT number to see the scheduled filing month and year.", href: "/tools/mcs-150-due-date-calculator", action: "Check an MCS-150 date" },
    ],
  },
];

export default function FreeToolsPage() {
  const compact = usePublicCompact();
  return <><Head><title>Free Trucking Compliance Tools | We Heart Paperwork</title><meta name="description" content="Build a personalized federal paperwork checklist and use free tools for new entrant audits, driver qualification files, drug and alcohol policies, maintenance records, accident registers, and MCS-150 due dates." /><link rel="canonical" href="https://weheartpaperwork.com/tools" /></Head><ScrollView style={styles.page} contentContainerStyle={styles.content}><PublicHeader />
    <View style={[styles.hero, compact && styles.heroCompact]}><Text style={styles.eyebrow}>FREE TOOLS</Text><Text accessibilityRole="header" style={[styles.title, compact && styles.titleCompact]}>Leave with something finished.</Text><Text style={styles.intro}>No account is required. Choose the job you need to complete and follow the tool one step at a time.</Text></View>
    <View style={[styles.toolGroups, compact && styles.toolGroupsCompact]}>{toolGroups.map(group => <View key={group.title} style={styles.group}><View style={styles.groupHeading}><Text accessibilityRole="header" style={styles.groupTitle}>{group.title}</Text><Text style={styles.groupText}>{group.text}</Text></View><View style={styles.toolList}>{group.tools.map(tool => tool.href === "/tools/mcs-150-due-date-calculator" ? <Link key={tool.href} href={tool.href as any} asChild><Pressable style={[styles.toolRow, compact && styles.toolRowCompact]}><View style={styles.toolCopy}><Text style={styles.toolTitle}>{tool.title}</Text><Text style={styles.toolText}>{tool.text}</Text></View><Text style={[styles.toolLink, compact && styles.toolLinkCompact]}>{tool.action} →</Text></Pressable></Link> : <Pressable key={tool.href} accessibilityRole="link" onPress={() => openStaticTool(tool.href)} style={[styles.toolRow, compact && styles.toolRowCompact]}><View style={styles.toolCopy}><Text style={styles.toolTitle}>{tool.title}</Text><Text style={styles.toolText}>{tool.text}</Text></View><Text style={[styles.toolLink, compact && styles.toolLinkCompact]}>{tool.action} →</Text></Pressable>)}</View></View>)}</View>
    <View style={styles.bridge}><Text style={styles.bridgeTitle}>Need the instructions first?</Text><Text style={styles.bridgeText}>The How-To library explains what applies, what to gather, what to do, and what to save.</Text><Link href={"/how-to" as any} asChild><Pressable style={styles.button}><Text style={styles.buttonText}>Open the How-To library</Text></Pressable></Link></View><PublicFooter />
  </ScrollView></>;
}

const styles=StyleSheet.create({page:{flex:1,backgroundColor:"#FAFAF8"},content:{minHeight:"100%"},hero:{width:"100%",maxWidth:1080,alignSelf:"center",paddingHorizontal:24,paddingTop:82,paddingBottom:52},heroCompact:{paddingHorizontal:18,paddingTop:48,paddingBottom:36},eyebrow:{marginBottom:13,color:"#3B6D11",fontSize:12,fontWeight:"800",letterSpacing:1.2},title:{maxWidth:800,color:"#1A1915",fontSize:52,lineHeight:57,fontWeight:"800",letterSpacing:-2},titleCompact:{fontSize:36,lineHeight:41},intro:{maxWidth:680,marginTop:18,color:"#5F5D57",fontSize:18,lineHeight:29},toolGroups:{width:"100%",maxWidth:1080,alignSelf:"center",paddingHorizontal:24,paddingBottom:86,gap:52},toolGroupsCompact:{paddingHorizontal:18,gap:40},group:{gap:18},groupHeading:{maxWidth:680},groupTitle:{color:"#1A1915",fontSize:25,lineHeight:31,fontWeight:"800"},groupText:{marginTop:7,color:"#6A6862",fontSize:14,lineHeight:22},toolList:{borderTopWidth:1,borderTopColor:"#D9D7CE"},toolRow:{minHeight:126,paddingVertical:24,paddingHorizontal:4,borderBottomWidth:1,borderBottomColor:"#D9D7CE",flexDirection:"row",alignItems:"center",gap:32},toolRowCompact:{minHeight:0,paddingVertical:22,flexDirection:"column",alignItems:"flex-start",gap:14},toolCopy:{flex:1,maxWidth:720},toolTitle:{color:"#1A1915",fontSize:20,lineHeight:26,fontWeight:"800"},toolText:{marginTop:7,color:"#5F5D57",fontSize:14,lineHeight:22},toolLink:{width:220,textAlign:"right",color:"#27500A",fontSize:13,fontWeight:"800"},toolLinkCompact:{width:"auto",textAlign:"left"},bridge:{paddingHorizontal:20,paddingVertical:72,alignItems:"center",backgroundColor:"#EEF4E9"},bridgeTitle:{textAlign:"center",color:"#1A1915",fontSize:30,fontWeight:"800"},bridgeText:{maxWidth:620,marginTop:12,textAlign:"center",color:"#5F5D57",fontSize:15,lineHeight:25},button:{minHeight:48,marginTop:22,paddingHorizontal:20,borderRadius:10,alignItems:"center",justifyContent:"center",backgroundColor:"#27500A"},buttonText:{color:"#FFFFFF",fontSize:14,fontWeight:"800"}});
