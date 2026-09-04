import { Link } from "expo-router";
import Head from "expo-router/head";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import PublicFooter from "../../components/public/PublicFooter";
import PublicHeader from "../../components/public/PublicHeader";
import { usePublicCompact } from "../../hooks/usePublicCompact";
import { openStaticTool } from "../../lib/openStaticTool";

const tools = [
  { title: "New Entrant Audit Tool", text: "Review the records an auditor may request and build a clear action list.", href: "/tools/new-entrant-audit/", action: "Open the audit checklist" },
  { title: "Driver Qualification File Builder", text: "Create a DQ file index, carrier-authored forms, and a list of official records still needed.", href: "/tools/driver-qualification-file/", action: "Build a DQ packet" },
  { title: "Vehicle Maintenance File Builder", text: "Build a vehicle identity record, preventive-maintenance schedule, repair log, and annual-inspection history for every unit.", href: "/tools/vehicle-maintenance-file/", action: "Build a maintenance file" },
  { title: "Accident Register Builder", text: "Decide whether an occurrence meets the federal definition, build the three-year register, and organize each supporting file.", href: "/tools/accident-register/", action: "Build an accident register" },
  { title: "MCS-150 Due Date Calculator", text: "Use the last two digits of a USDOT number to see the scheduled filing month and year.", href: "/tools/mcs-150-due-date-calculator", action: "Check an MCS-150 date" },
];

export default function FreeToolsPage() {
  const compact = usePublicCompact();
  return <><Head><title>Free Trucking Compliance Tools | We Heart Paperwork</title><meta name="description" content="Free tools for new entrant audits, driver qualification files, vehicle maintenance records, accident registers, and MCS-150 due dates." /><link rel="canonical" href="https://weheartpaperwork.com/tools" /></Head><ScrollView style={styles.page} contentContainerStyle={styles.content}><PublicHeader />
    <View style={[styles.hero, compact && styles.heroCompact]}><Text style={styles.eyebrow}>FREE TOOLS</Text><Text accessibilityRole="header" style={[styles.title, compact && styles.titleCompact]}>Leave with something finished.</Text><Text style={styles.intro}>No account is required. Choose the job you need to complete and follow the tool one step at a time.</Text></View>
    <View style={[styles.grid, compact && styles.gridCompact]}>{tools.map(tool => tool.href === "/tools/mcs-150-due-date-calculator" ? <Link key={tool.href} href={tool.href as any} asChild><Pressable style={styles.card}><Text style={styles.cardTitle}>{tool.title}</Text><Text style={styles.cardText}>{tool.text}</Text><Text style={styles.cardLink}>{tool.action} →</Text></Pressable></Link> : <Pressable key={tool.href} accessibilityRole="link" onPress={() => openStaticTool(tool.href)} style={styles.card}><Text style={styles.cardTitle}>{tool.title}</Text><Text style={styles.cardText}>{tool.text}</Text><Text style={styles.cardLink}>{tool.action} →</Text></Pressable>)}</View>
    <View style={styles.bridge}><Text style={styles.bridgeTitle}>Need the instructions first?</Text><Text style={styles.bridgeText}>The How-To library explains what applies, what to gather, what to do, and what to save.</Text><Link href={"/how-to" as any} asChild><Pressable style={styles.button}><Text style={styles.buttonText}>Open the How-To library</Text></Pressable></Link></View><PublicFooter />
  </ScrollView></>;
}

const styles=StyleSheet.create({page:{flex:1,backgroundColor:"#FAFAF8"},content:{minHeight:"100%"},hero:{width:"100%",maxWidth:1080,alignSelf:"center",paddingHorizontal:24,paddingTop:82,paddingBottom:52},heroCompact:{paddingHorizontal:18,paddingTop:48,paddingBottom:36},eyebrow:{marginBottom:13,color:"#3B6D11",fontSize:12,fontWeight:"800",letterSpacing:1.2},title:{maxWidth:800,color:"#1A1915",fontSize:52,lineHeight:57,fontWeight:"800",letterSpacing:-2},titleCompact:{fontSize:36,lineHeight:41},intro:{maxWidth:680,marginTop:18,color:"#5F5D57",fontSize:18,lineHeight:29},grid:{width:"100%",maxWidth:1080,alignSelf:"center",paddingHorizontal:24,paddingBottom:86,flexDirection:"row",flexWrap:"wrap",gap:16},gridCompact:{paddingHorizontal:18,flexDirection:"column"},card:{flexGrow:1,flexBasis:300,minHeight:230,padding:25,borderWidth:1,borderColor:"#E5E3DA",borderRadius:18,backgroundColor:"#FFFFFF"},cardTitle:{color:"#1A1915",fontSize:22,lineHeight:28,fontWeight:"800"},cardText:{marginTop:11,color:"#5F5D57",fontSize:14,lineHeight:23},cardLink:{marginTop:"auto",paddingTop:20,color:"#27500A",fontSize:13,fontWeight:"800"},bridge:{paddingHorizontal:20,paddingVertical:72,alignItems:"center",backgroundColor:"#EEF4E9"},bridgeTitle:{textAlign:"center",color:"#1A1915",fontSize:30,fontWeight:"800"},bridgeText:{maxWidth:620,marginTop:12,textAlign:"center",color:"#5F5D57",fontSize:15,lineHeight:25},button:{minHeight:48,marginTop:22,paddingHorizontal:20,borderRadius:10,alignItems:"center",justifyContent:"center",backgroundColor:"#27500A"},buttonText:{color:"#FFFFFF",fontSize:14,fontWeight:"800"}});
