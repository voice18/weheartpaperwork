import { useEffect, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { Link } from "expo-router";
import Head from "expo-router/head";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import PublicFooter from "../components/public/PublicFooter";
import PublicHeader from "../components/public/PublicHeader";
import { db } from "../lib/firebase";

type PublicReview = { id: string; rating: number; reviewText: string; reviewerName: string; reviewerTitle?: string | null; companyName?: string | null; incentiveReceived?: boolean };

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void getDocs(query(collection(db, "publicCustomerReviews"), orderBy("publishedAt", "desc"), limit(100)))
      .then(snapshot => { if (active) setReviews(snapshot.docs.map(document => ({ id: document.id, ...document.data() } as PublicReview))); })
      .catch(() => { if (active) setLoadFailed(true); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  return <>
    <Head><title>Customer Reviews | We Heart Paperwork</title><meta name="description" content="Read feedback from verified trucking-company customers who use We Heart Paperwork to organize DOT compliance deadlines and records." /><link rel="canonical" href="https://weheartpaperwork.com/reviews" /><meta name="robots" content="index,follow" /></Head>
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <PublicHeader />
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>VERIFIED CUSTOMER REVIEWS</Text>
        <Text accessibilityRole="header" style={styles.title}>What trucking companies say.</Text>
        <Text style={styles.intro}>These reviews come from authenticated We Heart Paperwork customers with an active account or trial. We publish genuine feedback without changing its meaning, whether it is favorable or critical.</Text>
        <Link href={"/review" as any} asChild><Pressable style={styles.button}><Text style={styles.buttonText}>Leave a verified review</Text></Pressable></Link>
      </View>
      <View style={styles.grid}>
        {reviews.map(review => <View key={review.id} style={styles.card}>
          <Text accessibilityLabel={`${review.rating} out of 5 stars`} style={styles.stars}>{"★".repeat(review.rating)}{"☆".repeat(5-review.rating)}</Text>
          <Text style={styles.quote}>“{review.reviewText}”</Text>
          <Text style={styles.name}>{review.reviewerName}</Text>
          {(review.reviewerTitle || review.companyName) && <Text style={styles.company}>{[review.reviewerTitle, review.companyName].filter(Boolean).join(" · ")}</Text>}
          <Text style={styles.verified}>✓ Verified customer</Text>
          {review.incentiveReceived && <Text style={styles.disclosure}>The reviewer disclosed receiving an incentive for submitting a review. The incentive was not conditioned on a positive rating.</Text>}
        </View>)}
        {!loaded && <View style={styles.empty}><Text style={styles.emptyTitle}>Loading verified reviews…</Text></View>}
        {loaded && !loadFailed && reviews.length === 0 && <View style={styles.empty}><Text style={styles.emptyTitle}>Customer reviews are coming soon.</Text><Text style={styles.company}>Only verified customer reviews will appear here.</Text></View>}
        {loadFailed && <Text style={styles.loadNote}>The review list could not refresh. Please try again later.</Text>}
      </View>
      <View style={styles.policy}><Text style={styles.policyTitle}>How reviews work</Text><Text style={styles.policyText}>Only authenticated customers with an active account or trial can submit. Reviews are checked for authenticity, private information, spam, harassment, and unrelated content. Ratings are not changed, and critical reviews are held to the same standards as positive reviews. Customers can withdraw permission to publish their review.</Text></View>
      <PublicFooter />
    </ScrollView>
  </>;
}

const styles = StyleSheet.create({
  page:{flex:1,backgroundColor:"#FAFAF8"},content:{minHeight:"100%"},hero:{width:"100%",maxWidth:900,alignSelf:"center",paddingHorizontal:24,paddingTop:72,paddingBottom:42},eyebrow:{color:"#3B6D11",fontSize:12,fontWeight:"800",letterSpacing:1.1,marginBottom:14},title:{color:"#1A1915",fontSize:52,lineHeight:58,fontWeight:"800",letterSpacing:-2,marginBottom:20},intro:{maxWidth:740,color:"#5F5D57",fontSize:17,lineHeight:28},button:{alignSelf:"flex-start",marginTop:26,minHeight:48,paddingHorizontal:20,borderRadius:11,alignItems:"center",justifyContent:"center",backgroundColor:"#27500A"},buttonText:{color:"#FFF",fontSize:14,fontWeight:"700"},grid:{width:"100%",maxWidth:900,alignSelf:"center",paddingHorizontal:24,paddingBottom:40,gap:18},card:{backgroundColor:"#FFF",borderWidth:1,borderColor:"#E5E3DA",borderRadius:16,padding:24},stars:{color:"#B36B00",fontSize:20,letterSpacing:2,marginBottom:14},quote:{color:"#1A1915",fontSize:17,lineHeight:27,marginBottom:18},name:{color:"#1A1915",fontSize:15,fontWeight:"800"},company:{color:"#706E68",fontSize:13,lineHeight:20,marginTop:3},verified:{color:"#3B6D11",fontSize:12,fontWeight:"800",marginTop:10},disclosure:{color:"#706E68",fontSize:11,lineHeight:17,marginTop:10},empty:{backgroundColor:"#F2F5EE",borderRadius:16,padding:28},emptyTitle:{color:"#1A1915",fontSize:20,fontWeight:"800"},loadNote:{color:"#854F0B",fontSize:12,lineHeight:18},policy:{width:"100%",maxWidth:900,alignSelf:"center",paddingHorizontal:24,paddingBottom:72},policyTitle:{color:"#1A1915",fontSize:24,fontWeight:"800",marginBottom:10},policyText:{color:"#5F5D57",fontSize:15,lineHeight:25},
});
