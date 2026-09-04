// app/(app)/dashboard/index.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Main compliance dashboard screen.
// Reads from Zustand store (which mirrors Firestore in real-time).
// This is where the dashboard component from our prototype plugs in.
// ─────────────────────────────────────────────────────────────────────────────

import {
  View, Text, ScrollView, TouchableOpacity,
StyleSheet, Platform, ActivityIndicator, Button,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useComplianceStore }            from "../../../store/useComplianceStore";
import {
  buildReqs,
  urgency,
  fmtDate,
  daysFrom,
  addDays,
  addYears,
} from "../../../lib/requirements";
import { useEffect, useState  }                      from "react";
import { useLocalSearchParams } from "expo-router";
import DashboardHeader from "../../../components/dashboard/DashboardHeader";
import SignalCards from "../../../components/dashboard/SignalCards";
import RequirementRow from "../../../components/dashboard/RequirementRow";
import CompanyRequirements from "../../../components/dashboard/CompanyRequirements";
import CustomRequirementsPanel from "../../../components/dashboard/CustomRequirementsPanel";
import DriversPanel from "../../../components/dashboard/DriversPanel";
import FleetPanel, {
  vehicleDeadlineItems,
} from "../../../components/dashboard/FleetPanel";
import type { FleetVehicle } from "../../../components/dashboard/FleetPanel";
import {
  collection,
  onSnapshot,
  doc,
} from "firebase/firestore";
import { auth, db } from "../../../lib/firebase";



export default function DashboardScreen() {
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{
  alertType?: string;
  itemIds?: string;
}>();

  const {
  compliance,
  usdotNumber,
  loading,
  saveDate,
  markComplete,
  markIncomplete,
  setUsdot,
  setApplicable,
} = useComplianceStore();

  const [filter, setFilter] = useState<"od"|"sn"|"up"|null>(null);
  const [tab, setTab] =
  useState<"overview" | "company" | "drivers" | "fleet">("overview");
  useEffect(() => {
    if (params.alertType || params.itemIds) {
      setTab("overview");
      setFilter(null);
    }
  }, [params.alertType, params.itemIds]);

  const [drivers, setDrivers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [customReqs, setCustomReqs] = useState<any[]>([]);


  useEffect(() => {
  const user = auth.currentUser;
  if (!user) return;

  const carrierRef = doc(db, "carriers", user.uid);

  const unsubCarrier = onSnapshot(carrierRef, (snap) => {
    const data = snap.data();

    setCompanyName(data?.companyName || "");
  });

  const unsubCompliance =
    useComplianceStore.getState().init(user.uid);

  const driversRef = collection(
    db,
    "carriers",
    user.uid,
    "drivers"
  );

  const unsubDrivers = onSnapshot(driversRef, (snapshot) => {
    const loadedDrivers = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));

    const activeDrivers = loadedDrivers.filter(
      (driver: any) => driver.status !== "inactive"
    );

    setDrivers(activeDrivers);
  });

  const unsubVehicles = onSnapshot(
    collection(db, "carriers", user.uid, "vehicles"),
    snapshot => setVehicles(snapshot.docs.map(item => ({
      id: item.id,
      ...item.data(),
    })) as FleetVehicle[])
  );

  return () => {
    unsubCompliance();
    unsubDrivers();
    unsubVehicles();
    unsubCarrier();
  };
}, []);

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#185FA5" />
      <Text style={styles.loadingText}>Loading compliance data…</Text>
    </View>
  );

  const reqs = buildReqs(compliance, usdotNumber);
  
  const driverReqs = drivers.flatMap((driver: any) => [
  {
    id: `driver-${driver.id}-cdl`,
    n: `CDL expiration — ${driver.name}`,
    f: "Driver",
    due: driver.cdlExpiration || null,
    de: false,
    notes: "Driver CDL expiration date.",
    cons: "An expired CDL prevents the driver from operating a CMV that requires that CDL.",
    act: "Update CDL expiration",
    completed: false,
  },
  {
    id: `driver-${driver.id}-medical`,
    n: `Medical card — ${driver.name}`,
    f: "Driver",
    due: driver.medicalExpiration || null,
    de: false,
    notes: "Driver medical card expiration.",
    cons: "Expired medical card can disqualify the driver.",
    act: "Update medical card",
    completed: false,
  },
  {
    id: `driver-${driver.id}-mvr`,
    n: `Annual MVR — ${driver.name}`,
    f: "Driver",
    due: addYears(driver.mvrDue, 1),
    de: false,
    notes: "Annual MVR review deadline.",
    cons: "Missing annual MVR review can create DQ file violations.",
    act: "Complete annual MVR review",
    completed: false,
  },
  {
    id: `driver-${driver.id}-clearinghouse`,
    n: `Clearinghouse query — ${driver.name}`,
    f: "Driver",
    due: addDays(driver.clearinghouseDue, 365),
    de: false,
    notes: "Annual Clearinghouse query deadline.",
    cons: "Missing annual Clearinghouse query is a DOT compliance issue.",
    act: "Run Clearinghouse query",
    completed: false,
  },
]);
  const visibleDriverReqs = driverReqs.filter((r: any) => {
  const u = urgency(r);
  return u === "od" || u === "sn" || u === "up";
});

const activeCustomReqs = customReqs.filter(item => item.applicable !== false);
const allReqs = [...reqs, ...activeCustomReqs, ...visibleDriverReqs];
const vehicleReqs = vehicleDeadlineItems(vehicles).filter((r: any) => {
  const u = urgency(r);
  return u === "od" || u === "sn" || u === "up";
});
const allTrackedReqs = [...allReqs, ...vehicleReqs];
  const od   = allTrackedReqs.filter(r => urgency(r) === "od");
  const sn   = allTrackedReqs.filter(r => urgency(r) === "sn");
  const up   = allTrackedReqs.filter(r => urgency(r) === "up");
  const exc  = [...od, ...sn, ...up];
  const active = filter === "od" ? od : filter === "sn" ? sn : filter === "up" ? up : exc;

      return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 40,
          },
        ]}
      >
      {/* Header */}
          <DashboardHeader
      companyName={companyName}
      usdotNumber={usdotNumber}
    />

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
 
  <TouchableOpacity
    onPress={() => setTab("overview")}
    style={{
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: tab === "overview" ? "#EAF3DE" : "#fff",
      borderWidth: 1,
      borderColor: "#D3D1C7",
    }}
  >
    <Text>Overview</Text>
  </TouchableOpacity>

  <TouchableOpacity
    onPress={() => setTab("company")}
    style={{
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: tab === "company" ? "#EAF3DE" : "#fff",
      borderWidth: 1,
      borderColor: "#D3D1C7",
    }}
  >
    <Text>Company</Text>
  </TouchableOpacity>

  <TouchableOpacity
    onPress={() => setTab("drivers")}
    style={{
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: tab === "drivers" ? "#EAF3DE" : "#fff",
      borderWidth: 1,
      borderColor: "#D3D1C7",
    }}
  >
    <Text>Drivers</Text>
  </TouchableOpacity>

  <TouchableOpacity
    onPress={() => setTab("fleet")}
    style={{
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: tab === "fleet" ? "#EAF3DE" : "#fff",
      borderWidth: 1,
      borderColor: "#D3D1C7",
    }}
  >
    <Text>Fleet</Text>
  </TouchableOpacity>
</View>

       
{tab === "overview" ? (
  <>
    <SignalCards
      overdueCount={od.length}
      soonCount={sn.length}
      upcomingCount={up.length}
      filter={filter}
      setFilter={setFilter}
    />

    <View
      style={{
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#E5E3DA",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: "#E5E3DA",
        }}
      >
        <Text
          style={{
            fontSize: 18,
            fontWeight: "700",
            color: "#1A1915",
          }}
        >
          Items needing attention
        </Text>

        <Text
          style={{
            marginTop: 4,
            fontSize: 13,
            lineHeight: 18,
            color: "#706E68",
          }}
        >
          Review the item here, then open Company, Drivers, or Fleet to update it.
        </Text>
      </View>

      {(filter ? active : exc).length === 0 ? (
        <View
          style={{
            padding: 20,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "600",
              color: "#27500A",
            }}
          >
            Nothing needs attention
          </Text>

          <Text
            style={{
              marginTop: 4,
              fontSize: 13,
              color: "#706E68",
              textAlign: "center",
            }}
          >
            Your current compliance items are outside the alert windows.
          </Text>
        </View>
      ) : (
        (filter ? active : exc).map((item, index) => {
          const isDriverItem = String(item.id).startsWith("driver-");
          const isVehicleItem = String(item.id).startsWith("vehicle:");
          const itemUrgency = urgency(item);

          const daysRemaining =
        item.due ? daysFrom(item.due) : null;

                const statusText =
        itemUrgency === "od"
          ? "Overdue"
          : daysRemaining === 0
            ? "Due today"
            : itemUrgency === "sn"
              ? "Due soon"
              : "Upcoming";

          const statusColor =
            itemUrgency === "od"
              ? "#A32D2D"
              : itemUrgency === "sn"
                ? "#854F0B"
                : "#185FA5";

          const statusBackground =
            itemUrgency === "od"
              ? "#FCEBEB"
              : itemUrgency === "sn"
                ? "#FAEEDA"
                : "#E6F1FB";

          return (
            <View
              key={String(item.id)}
              style={{
                padding: 16,
                borderBottomWidth:
                  index < (filter ? active : exc).length - 1 ? 1 : 0,
                borderBottomColor: "#E5E3DA",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "600",
                      color: "#1A1915",
                      lineHeight: 20,
                    }}
                  >
                    {item.n}
                  </Text>

                  <Text
                    style={{
                      marginTop: 3,
                      fontSize: 12,
                      color: "#706E68",
                    }}
                  >
                    {isDriverItem ? "Driver requirement" : isVehicleItem ? "Fleet requirement" : "Company requirement"}
                    {item.due ? ` · Due ${fmtDate(item.due)}` : ""}
                  </Text>
                </View>

                <View
                  style={{
                    paddingHorizontal: 9,
                    paddingVertical: 4,
                    borderRadius: 12,
                    backgroundColor: statusBackground,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: statusColor,
                    }}
                  >
                    {statusText}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() =>
                  setTab(isDriverItem ? "drivers" : isVehicleItem ? "fleet" : "company")
                }
                style={{
                  alignSelf: "flex-start",
                  marginTop: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: "#D3D1C7",
                  backgroundColor: "#FFFFFF",
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: "#27500A",
                  }}
                >
                  {isDriverItem
                    ? "Review in Drivers"
                    : isVehicleItem
                      ? "Review in Fleet"
                      : "Review in Company"}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })
      )}
    </View>
  </>
) : tab === "company" ? (
  <>
      <CompanyRequirements
      items={reqs}
      onSave={saveDate}
      onComplete={markComplete}
      onUndo={markIncomplete}
      onSetUsdot={setUsdot}
      onSetApplicable={setApplicable}
    />
    <CustomRequirementsPanel onItemsChange={setCustomReqs} />
  </>
) : tab === "drivers" ? (
  <DriversPanel />
) : (
  <FleetPanel />
)}
 </ScrollView>

  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

type SignalCardProps = {
  count: number;
  label: string;
  color: string;
  bg: string;
  active: boolean;
  onPress: () => void;
};

function SignalCard({
  count,
  label,
  color,
  bg,
  active,
  onPress,
}: SignalCardProps) {
  return (
    <TouchableOpacity onPress={onPress}
      style={[styles.sigCard, { backgroundColor: bg, borderColor: active ? color : "transparent", borderWidth: active ? 1.5 : 0.5 }]}>
      <Text style={[styles.sigCount, { color }]}>{count}</Text>
      <Text style={[styles.sigLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}



// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:      { flex:1, backgroundColor:"#FAFAF8" },
  content:        { paddingHorizontal: 16, },
  center:         { flex:1, alignItems:"center", justifyContent:"center" },
  loadingText:    { marginTop:12, fontSize:14, color:"#706E68" },
  header:         { marginBottom:16 },
  title:          { fontSize:22, fontWeight:"600", color:"#1A1915" },
  subtitle:       { fontSize:13, color:"#B0AEA8", marginTop:2 },
  signalRow:      { flexDirection:"row", gap:8, marginBottom:16 },
  sigCard:        { flex:1, borderRadius:10, padding:12, alignItems:"center", borderWidth:0.5 },
  sigCount:       { fontSize:26, fontWeight:"600" },
  sigLabel:       { fontSize:11, fontWeight:"500", marginTop:2 },
  allClear:       { backgroundColor:"#F1EFF8", borderRadius:10, padding:20, alignItems:"center" },
  allClearTitle:  { fontSize:16, fontWeight:"600", color:"#1A1915" },
  allClearSub:    { fontSize:13, color:"#706E68", marginTop:4 },
  list:           { gap:1, borderRadius:10, overflow:"hidden", borderWidth:0.5, borderColor:"#E0DDD5" },
  row:            { backgroundColor:"#fff" },
  rowHeader:      { flexDirection:"row", alignItems:"flex-start", padding:12, gap:12 },
  rowLeft:        { flex:1 },
  rowName:        { fontSize:13, fontWeight:"500", color:"#1A1915", lineHeight:18 },
  rowMeta:        { fontSize:12, color:"#8A8880", marginTop:2 },
  badge:          { paddingHorizontal:9, paddingVertical:3, borderRadius:10 },
  badgeText:      { fontSize:12, fontWeight:"500" },
  detail:         { paddingHorizontal:12, paddingBottom:14, borderTopWidth:0.5, borderColor:"#F0EDE6" },
  detailNotes:    { fontSize:12, color:"#706E68", lineHeight:18, paddingVertical:8 },
  detailRow:      { flexDirection:"row", justifyContent:"space-between", paddingVertical:5 },
  detailLabel:    { fontSize:12, color:"#706E68" },
  detailValue:    { fontSize:12, fontWeight:"500", color:"#1A1915" },
  consequence:    { backgroundColor:"#FCEBEB", borderRadius:6, padding:10, marginVertical:8 },
  consequenceText:{ fontSize:12, color:"#791F1F", lineHeight:17 },
  completeBtn:    { backgroundColor:"#EAF3DE", borderRadius:6, padding:10, alignItems:"center", marginTop:4 },
  completeBtnText:{ fontSize:13, fontWeight:"500", color:"#27500A" },
  undoBtn:        { padding:8, alignItems:"center" },
  undoBtnText:    { fontSize:12, color:"#3B6D11", textDecorationLine:"underline" },
    
});
