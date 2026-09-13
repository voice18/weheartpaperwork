import { useCallback, useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { useRouter } from "expo-router";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { functions } from "../../lib/firebase";

type Review = { id:string; rating:number; reviewText:string; reviewerName:string; reviewerTitle?:string|null;
  companyName?:string|null; incentiveReceived:boolean; moderationStatus:string; submittedAtMillis?:number|null };
type Feedback = { id:string; category:string; message:string; companyName:string; contactAllowed:boolean; contactEmail?:string|null; status:string };

export default function OwnerReviews() {
  const router=useRouter(); const [reviews,setReviews]=useState<Review[]>([]); const [loading,setLoading]=useState(true);
  const [feedback,setFeedback]=useState<Feedback[]>([]);
  const [loadFailed,setLoadFailed]=useState(false);
  const [message,setMessage]=useState(""); const [working,setWorking]=useState<string|null>(null);
  const load=useCallback(async()=>{ setLoading(true); setLoadFailed(false); setMessage(""); try {
    const result=await httpsCallable<Record<string,never>,{reviews:Review[];feedback:Feedback[]}>(functions,"listCustomerReviewsForModeration")({});
    setReviews(result.data.reviews); setFeedback(result.data.feedback||[]);
  } catch(error:any){ setLoadFailed(true); setMessage(error?.code==="functions/permission-denied"?"Owner access has not refreshed. Sign out, sign back in, and try again.":"The owner inbox could not load. Your submissions are still safe. Try again in a moment."); } finally { setLoading(false); } },[]);
  useEffect(()=>{void load();},[load]);
  const moderate=async(review:Review,decision:"publish"|"reject")=>{
    setWorking(review.id); setMessage(""); try {
      await httpsCallable(functions,"moderateCustomerReview")({reviewId:review.id,decision});
      setMessage(decision==="publish"?"Review published.":"Review rejected and kept private."); await load();
    } catch(error:any){setMessage(error?.message||"Unable to update the review.");} finally{setWorking(null);}
  };
  const confirm=(review:Review,decision:"publish"|"reject")=>{
    const title=decision==="publish"?"Publish this review?":"Reject this review?";
    const detail=decision==="publish"?"It will become visible on the public reviews page.":"It will remain private and will not appear publicly.";
    if (Platform.OS==="web") {
      if (typeof window!=="undefined"&&window.confirm(`${title}\n\n${detail}`)) void moderate(review,decision);
      return;
    }
    Alert.alert(title,detail,[{text:"Cancel",style:"cancel"},{text:decision==="publish"?"Publish":"Reject",style:decision==="reject"?"destructive":"default",onPress:()=>void moderate(review,decision)}]);
  };
  const pending=reviews.filter(review=>review.moderationStatus==="pending");
  const newFeedback=feedback.filter(item=>item.status==="new");
  const acknowledge=async(item:Feedback)=>{setWorking(item.id);try{await httpsCallable(functions,"updateCustomerFeedbackStatus")({feedbackId:item.id,status:"acknowledged"});await load();}catch(error:any){setMessage(error?.message||"Unable to update feedback.");}finally{setWorking(null);}};
  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <Pressable onPress={()=>router.replace("/(app)/settings")}><Text style={styles.back}>‹ Back to Settings</Text></Pressable>
    <Text style={styles.eyebrow}>OWNER TOOLS</Text><Text style={styles.title}>Review inbox</Text>
    <Text style={styles.help}>Read each submission before deciding. Publish praise and criticism under the same standards.</Text>
    {!!message&&<Text style={styles.message}>{message}</Text>}
    {loading?<ActivityIndicator color="#27500A" size="large"/>:loadFailed?<Pressable onPress={()=>void load()} style={styles.retry}><Text style={styles.publishText}>Try again</Text></Pressable>:<><Text style={styles.section}>Customer feedback</Text>
      {newFeedback.length===0?<View style={styles.empty}><Text style={styles.emptyTitle}>No new feedback.</Text></View>:newFeedback.map(item=><View key={item.id} style={styles.card}><Text style={styles.feedbackType}>{item.category.toUpperCase()}</Text><Text style={styles.review}>{item.message}</Text><Text style={styles.name}>{item.companyName}</Text><Text style={styles.meta}>{item.contactAllowed&&item.contactEmail?`Follow-up allowed: ${item.contactEmail}`:"No follow-up permission"}</Text><Pressable disabled={working===item.id} onPress={()=>void acknowledge(item)} style={styles.ack}><Text style={styles.publishText}>Mark acknowledged</Text></Pressable></View>)}
      <Text style={styles.section}>Reviews awaiting publication</Text>{pending.length===0?<View style={styles.empty}><Text style={styles.emptyTitle}>No reviews are waiting.</Text><Text style={styles.meta}>{reviews.length} total submission{reviews.length===1?"":"s"} on record.</Text></View>:
      pending.map(review=><View key={review.id} style={styles.card}>
        <Text accessibilityLabel={`${review.rating} out of 5 stars`} style={styles.stars}>{"★".repeat(review.rating)}{"☆".repeat(5-review.rating)}</Text>
        <Text style={styles.review}>“{review.reviewText}”</Text><Text style={styles.name}>{review.reviewerName}</Text>
        <Text style={styles.meta}>{[review.reviewerTitle,review.companyName].filter(Boolean).join(" · ")||"Company name not authorized for display"}</Text>
        {review.incentiveReceived&&<Text style={styles.disclosure}>Reviewer disclosed receiving an incentive. The public review will include that disclosure.</Text>}
        <View style={styles.actions}><Pressable disabled={working===review.id} onPress={()=>confirm(review,"publish")} style={styles.publish}><Text style={styles.publishText}>Publish</Text></Pressable>
          <Pressable disabled={working===review.id} onPress={()=>confirm(review,"reject")} style={styles.reject}><Text style={styles.rejectText}>Reject</Text></Pressable></View>
      </View>)}</>}
  </ScrollView>;
}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:"#F6F5F1"},content:{width:"100%",maxWidth:760,alignSelf:"center",padding:24,paddingBottom:72},back:{color:"#27500A",fontWeight:"800",marginBottom:30},eyebrow:{color:"#3B6D11",fontSize:12,fontWeight:"800",letterSpacing:1.1},title:{color:"#1A1915",fontSize:40,lineHeight:46,fontWeight:"800",marginTop:8},help:{color:"#5F5D57",fontSize:15,lineHeight:24,marginTop:12,marginBottom:24},section:{fontSize:22,fontWeight:"800",color:"#1A1915",marginTop:18,marginBottom:12},message:{padding:12,backgroundColor:"#FFF1F0",color:"#842029",borderRadius:8,marginBottom:16},retry:{alignSelf:"flex-start",backgroundColor:"#27500A",borderRadius:9,paddingHorizontal:20,paddingVertical:12},empty:{padding:24,backgroundColor:"#FFF",borderRadius:14,marginBottom:18},emptyTitle:{fontSize:18,fontWeight:"800",color:"#1A1915"},card:{padding:22,backgroundColor:"#FFF",borderWidth:1,borderColor:"#E5E3DA",borderRadius:14,marginBottom:16},feedbackType:{color:"#3B6D11",fontSize:11,fontWeight:"800",letterSpacing:1},stars:{color:"#B36B00",fontSize:20},review:{color:"#1A1915",fontSize:16,lineHeight:25,marginTop:12},name:{fontWeight:"800",color:"#1A1915",marginTop:16},meta:{color:"#706E68",fontSize:12,lineHeight:18,marginTop:4},disclosure:{color:"#854F0B",fontSize:12,lineHeight:18,marginTop:10},actions:{flexDirection:"row",gap:10,marginTop:20},publish:{backgroundColor:"#27500A",borderRadius:9,paddingHorizontal:20,paddingVertical:12},ack:{alignSelf:"flex-start",backgroundColor:"#27500A",borderRadius:9,paddingHorizontal:16,paddingVertical:10,marginTop:16},publishText:{color:"#FFF",fontWeight:"800"},reject:{borderWidth:1,borderColor:"#A32D2D",borderRadius:9,paddingHorizontal:20,paddingVertical:12},rejectText:{color:"#A32D2D",fontWeight:"800"}});
