import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
} from "firebase/firestore";

import { auth, db } from "../../lib/firebase";
import {
  addInterval,
  calendarPeriodEnd,
  fmtDate,
  localDateString,
  nextCalendarPeriodEnd,
} from "../../lib/requirements";
import { formatDateInput, inputToIso } from "../../lib/dateUtils";
import type {
  CustomRequirement,
  CustomRequirementIntervalUnit,
  CustomRequirementRecurrenceKind,
  CustomRequirementScheduleType,
} from "../../lib/types";
import RequirementRow from "./RequirementRow";

type Props = { onItemsChange?: (items: any[]) => void };
type RecurrencePreset = "monthly" | "quarterly" | "custom";

function recurrenceDescription(item: CustomRequirement): string {
  if (item.scheduleType !== "rolling") return "Fixed date";
  if (item.recurrenceKind === "calendar-monthly") return "Calendar month · period ends monthly";
  if (item.recurrenceKind === "calendar-quarterly") return "Calendar quarter · period ends quarterly";
  return `Recurring · every ${item.intervalValue} ${item.intervalUnit}${item.intervalValue === 1 ? "" : "s"}`;
}

export default function CustomRequirementsPanel({ onItemsChange }: Props) {
  const [items, setItems] = useState<CustomRequirement[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [scheduleType, setScheduleType] =
    useState<CustomRequirementScheduleType>("fixed");
  const [dueDate, setDueDate] = useState("");
  const [intervalValue, setIntervalValue] = useState("1");
  const [intervalUnit, setIntervalUnit] =
    useState<CustomRequirementIntervalUnit>("month");
  const [recurrencePreset, setRecurrencePreset] =
    useState<RecurrencePreset>("monthly");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const carrierId = auth.currentUser?.uid;
    if (!carrierId) return;
    return onSnapshot(
      collection(db, "carriers", carrierId, "customRequirements"),
      snapshot => {
        setItems(snapshot.docs.map(item => {
          const data = item.data();
          return {
            id: item.id,
            name: String(data.name || "Custom requirement"),
            scheduleType: data.scheduleType === "rolling" ? "rolling" : "fixed",
            dueDate: typeof data.dueDate === "string" ? data.dueDate : "",
            intervalValue: typeof data.intervalValue === "number" ? data.intervalValue : null,
            intervalUnit: data.intervalUnit || null,
            recurrenceKind:
              data.recurrenceKind === "calendar-monthly" ||
              data.recurrenceKind === "calendar-quarterly" ||
              data.recurrenceKind === "custom-interval"
                ? data.recurrenceKind
                : data.scheduleType === "rolling"
                  ? "custom-interval"
                  : null,
            active: data.active !== false,
            notes: typeof data.notes === "string" ? data.notes : null,
            completed: data.completed === true,
            completedAt: data.completedAt instanceof Timestamp ? data.completedAt.toDate() : null,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : null,
          } as CustomRequirement;
        }).sort((a, b) => a.name.localeCompare(b.name)));
      }
    );
  }, []);

  const rows = useMemo(() => items.map(item => ({
    id: item.id,
    n: item.name,
    f: recurrenceDescription(item),
    due: item.dueDate || null,
    enteredDate: item.dueDate || null,
    de: true,
    dateMode: item.recurrenceKind?.startsWith("calendar-") ? "fixed-calendar" : "fixed-user-date",
    dl: item.recurrenceKind?.startsWith("calendar-") ? "Reporting period ends" : "Next due date",
    notes: item.notes || "Company-specific compliance requirement.",
    cons: "Missing this company-specific requirement may affect your compliance obligations.",
    act: "Complete requirement",
    completed: item.completed,
    applicable: item.active,
    canBeNotApplicable: true,
    isCustom: true,
    scheduleType: item.scheduleType,
    intervalValue: item.intervalValue,
    intervalUnit: item.intervalUnit,
    recurrenceKind: item.recurrenceKind,
    periodBased: item.recurrenceKind?.startsWith("calendar-") === true,
  })), [items]);

  useEffect(() => { onItemsChange?.(rows); }, [onItemsChange, rows]);

  async function createRequirement() {
    const carrierId = auth.currentUser?.uid;
    const recurrenceKind: CustomRequirementRecurrenceKind | null =
      scheduleType !== "rolling"
        ? null
        : recurrencePreset === "monthly"
          ? "calendar-monthly"
          : recurrencePreset === "quarterly"
            ? "calendar-quarterly"
            : "custom-interval";
    const isoDueDate = recurrenceKind === "calendar-monthly"
      ? calendarPeriodEnd(localDateString(), "monthly")
      : recurrenceKind === "calendar-quarterly"
        ? calendarPeriodEnd(localDateString(), "quarterly")
        : inputToIso(dueDate);
    const numericInterval = Number(intervalValue);
    if (!carrierId || !name.trim() || !isoDueDate) {
      Alert.alert("Missing information", "Enter a name and valid due date.");
      return;
    }
    if (scheduleType === "rolling" && (!Number.isInteger(numericInterval) || numericInterval < 1)) {
      Alert.alert("Invalid interval", "Enter a whole interval of at least 1.");
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, "carriers", carrierId, "customRequirements"), {
        name: name.trim(), scheduleType, dueDate: isoDueDate, recurrenceKind,
        intervalValue: scheduleType === "rolling" ? numericInterval : null,
        intervalUnit: scheduleType === "rolling" ? intervalUnit : null,
        active: true, notes: notes.trim() || null, completed: false,
        completedAt: null, notified30: false, notified90: false,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      setName(""); setDueDate(""); setNotes(""); setIntervalValue("1");
      setIntervalUnit("month"); setRecurrencePreset("monthly");
      setScheduleType("fixed"); setAdding(false);
    } finally { setSaving(false); }
  }

  async function saveDate(id: string, _enteredDate: string, nextDueDate: string) {
    const carrierId = auth.currentUser?.uid;
    if (!carrierId) return;
    await setDoc(doc(db, "carriers", carrierId, "customRequirements", id), {
      dueDate: nextDueDate, completed: false, completedAt: null,
      notified30: false, notified90: false, updatedAt: serverTimestamp(),
    }, { merge: true });
  }

  async function setActive(id: string, active: boolean) {
    const carrierId = auth.currentUser?.uid;
    if (!carrierId) return;
    await setDoc(doc(db, "carriers", carrierId, "customRequirements", id), {
      active, notified30: false, notified90: false, updatedAt: serverTimestamp(),
    }, { merge: true });
  }

  async function markComplete(id: string, completionDate: string) {
    const carrierId = auth.currentUser?.uid;
    const item = items.find(candidate => candidate.id === id);
    if (!carrierId || !item) return;
    const isCalendarPeriod = item.recurrenceKind === "calendar-monthly" || item.recurrenceKind === "calendar-quarterly";
    if (isCalendarPeriod && completionDate <= item.dueDate) {
      const message = "This item can be marked filed after the calendar period ends.";
      if (Platform.OS === "web") window.alert(`Reporting period is still open\n\n${message}`);
      else Alert.alert("Reporting period is still open", message);
      return;
    }
    const nextDueDate = item.recurrenceKind === "calendar-monthly"
      ? nextCalendarPeriodEnd(item.dueDate, "monthly")
      : item.recurrenceKind === "calendar-quarterly"
        ? nextCalendarPeriodEnd(item.dueDate, "quarterly")
        : item.scheduleType === "rolling" && item.intervalValue && item.intervalUnit
          ? addInterval(item.dueDate, item.intervalValue, item.intervalUnit)
          : item.dueDate;
    if (!nextDueDate) return;
    const requirementRef = doc(db, "carriers", carrierId, "customRequirements", id);
    const historyRef = doc(collection(requirementRef, "history"));
    const user = auth.currentUser;
    const batch = writeBatch(db);
    batch.set(historyRef, {
      recordType: "completion", requirementId: id, carrierId,
      completionDate, completedAt: serverTimestamp(),
      completedByUserId: user?.uid || null,
      completedByName: user?.displayName || user?.email || "Account owner",
      previousDueDate: item.dueDate, previousEnteredDate: item.dueDate,
      nextDueDate, note: null, file: null, source: "company-custom",
      createdAt: serverTimestamp(),
    });
    batch.set(requirementRef, {
      dueDate: nextDueDate,
      completed: item.scheduleType === "fixed",
      completedDate: completionDate,
      completedAt: serverTimestamp(), notified30: false, notified90: false,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    await batch.commit();
  }

  async function undo(id: string) {
    const carrierId = auth.currentUser?.uid;
    if (!carrierId) return;
    await setDoc(doc(db, "carriers", carrierId, "customRequirements", id), {
      completed: false, completedDate: null, completedAt: null,
      notified30: false, notified90: false, updatedAt: serverTimestamp(),
    }, { merge: true });
  }

  function confirmDelete(id: string, itemName: string) {
    const remove = async () => {
      const carrierId = auth.currentUser?.uid;
      if (!carrierId) return;
      const requirementRef = doc(db, "carriers", carrierId, "customRequirements", id);
      const history = await getDocs(collection(requirementRef, "history"));
      for (let index = 0; index < history.docs.length; index += 450) {
        const historyBatch = writeBatch(db);
        history.docs.slice(index, index + 450).forEach(record => historyBatch.delete(record.ref));
        await historyBatch.commit();
      }
      const requirementBatch = writeBatch(db);
      requirementBatch.delete(requirementRef);
      await requirementBatch.commit();
    };
    const message = `Delete ${itemName} and all of its history? This cannot be undone.`;
    if (Platform.OS === "web") { if (window.confirm(message)) void remove(); return; }
    Alert.alert("Delete custom requirement?", message, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void remove() },
    ]);
  }

  return <View style={styles.section}>
    <View style={styles.headingRow}>
      <View style={styles.headingCopy}><Text style={styles.heading}>Custom requirements</Text>
        <Text style={styles.subheading}>Track company or state-specific deadlines.</Text></View>
      <TouchableOpacity style={styles.addButton} onPress={() => setAdding(value => !value)}>
        <Text style={styles.addButtonText}>+ Add custom requirement</Text>
      </TouchableOpacity>
    </View>
    {adding && <View style={styles.form}>
      <Text style={styles.label}>Requirement name</Text><TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Oregon Weight-Mile Tax" />
      <Text style={styles.label}>Schedule</Text><View style={styles.choiceRow}>
        {(["fixed", "rolling"] as const).map(value => <TouchableOpacity key={value} onPress={() => setScheduleType(value)} style={[styles.choice, scheduleType === value && styles.choiceActive]}><Text>{value === "fixed" ? "Fixed date" : "Recurring"}</Text></TouchableOpacity>)}
      </View>
      <Text style={styles.helpText}>{scheduleType === "fixed" ? "Completion records history; you enter the next due date." : "Calendar periods stay fixed. Other intervals advance from the scheduled date."}</Text>
      {scheduleType === "rolling" && <><Text style={styles.label}>Frequency</Text><View style={styles.choiceRow}>
        {(["monthly", "quarterly", "custom"] as const).map(value => <TouchableOpacity key={value} onPress={() => {
          setRecurrencePreset(value);
          if (value === "monthly") { setIntervalValue("1"); setIntervalUnit("month"); }
          if (value === "quarterly") { setIntervalValue("3"); setIntervalUnit("month"); }
        }} style={[styles.choice, recurrencePreset === value && styles.choiceActive]}><Text>{value === "custom" ? "Other interval" : value[0].toUpperCase() + value.slice(1)}</Text></TouchableOpacity>)}
      </View>
      {recurrencePreset === "custom" && <><Text style={styles.label}>Repeat every</Text><View style={styles.choiceRow}>
          <TextInput style={[styles.input, styles.intervalInput]} value={intervalValue} onChangeText={setIntervalValue} keyboardType="number-pad" />
          {(["day", "week", "month", "year"] as const).map(value => <TouchableOpacity key={value} onPress={() => setIntervalUnit(value)} style={[styles.choice, intervalUnit === value && styles.choiceActive]}><Text>{value}</Text></TouchableOpacity>)}
        </View></>}
      </>}
      {(scheduleType === "fixed" || recurrencePreset === "custom") && <><Text style={styles.label}>{scheduleType === "fixed" ? "Due date" : "First due date"}</Text><TextInput style={styles.input} value={dueDate} onChangeText={text => setDueDate(formatDateInput(text))} placeholder="MM-DD-YYYY" /></>}
      {scheduleType === "rolling" && recurrencePreset !== "custom" && <View style={styles.periodPreview}>
        <Text style={styles.periodPreviewLabel}>Current reporting period ends</Text>
        <Text style={styles.periodPreviewDate}>{fmtDate(calendarPeriodEnd(localDateString(), recurrencePreset))}</Text>
        <Text style={styles.periodPreviewHelp}>{recurrencePreset === "monthly" ? "Monthly always follows the calendar month." : "Quarterly always follows Jan–Mar, Apr–Jun, Jul–Sep, and Oct–Dec."}</Text>
      </View>}
      <Text style={styles.label}>Notes (optional)</Text><TextInput style={[styles.input, { minHeight: 70 }]} value={notes} onChangeText={setNotes} multiline />
      <View style={styles.choiceRow}><TouchableOpacity style={styles.cancelButton} onPress={() => setAdding(false)}><Text>Cancel</Text></TouchableOpacity><TouchableOpacity disabled={saving} style={styles.saveButton} onPress={() => void createRequirement()}><Text style={styles.saveText}>{saving ? "Saving..." : "Add requirement"}</Text></TouchableOpacity></View>
    </View>}
    {rows.map(row => <View key={row.id}><RequirementRow r={row} onSave={saveDate} onComplete={markComplete} onUndo={undo} onSetUsdot={() => {}} onSetApplicable={setActive} /><TouchableOpacity style={styles.deleteLink} onPress={() => confirmDelete(row.id, row.n)}><Text style={styles.deleteText}>Delete custom requirement</Text></TouchableOpacity></View>)}
  </View>;
}

const styles = StyleSheet.create({
  section: { marginTop: 22 }, headingRow: { alignItems: "flex-start", gap: 12, marginBottom: 12 }, headingCopy: { width: "100%" },
  heading: { fontSize: 18, fontWeight: "700", color: "#1A1915" }, subheading: { fontSize: 13, color: "#706E68", marginTop: 3 },
  addButton: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: "#BFC9B5", backgroundColor: "#FFFFFF" }, addButtonText: { fontSize: 13, fontWeight: "700", color: "#27500A" },
  form: { padding: 14, marginBottom: 14, borderWidth: 1, borderColor: "#D6E4C9", borderRadius: 12, backgroundColor: "#F8FAF5" }, label: { fontSize: 12, color: "#706E68", marginTop: 10, marginBottom: 5 },
  helpText: { marginTop: 7, color: "#706E68", fontSize: 12, lineHeight: 17 },
  input: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D3D1C7", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9 }, choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  intervalInput: { width: 74 },
  periodPreview: { marginTop: 12, padding: 12, borderRadius: 9, backgroundColor: "#EEF4E9", borderWidth: 1, borderColor: "#D6E4C9" },
  periodPreviewLabel: { fontSize: 11, color: "#706E68" },
  periodPreviewDate: { marginTop: 3, fontSize: 14, fontWeight: "700", color: "#27500A" },
  periodPreviewHelp: { marginTop: 5, fontSize: 11, lineHeight: 16, color: "#706E68" },
  choice: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: "#D3D1C7", backgroundColor: "#FFFFFF" }, choiceActive: { borderColor: "#9FC36A", backgroundColor: "#EAF3DE" },
  cancelButton: { marginTop: 14, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: "#D3D1C7", backgroundColor: "#FFFFFF" }, saveButton: { marginTop: 14, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 8, backgroundColor: "#DDEFC5", borderWidth: 1, borderColor: "#9FC36A" }, saveText: { color: "#27500A", fontWeight: "700" },
  deleteLink: { alignSelf: "flex-start", marginTop: -4, marginBottom: 12, paddingVertical: 4 }, deleteText: { fontSize: 12, color: "#A32D2D", textDecorationLine: "underline" },
});
