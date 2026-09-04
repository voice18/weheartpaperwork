import { useEffect, useState } from "react";
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
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";

import { auth, db } from "../../lib/firebase";
import { addYears, daysFrom, fmtDate, localDateString } from "../../lib/requirements";
import { formatDateInput, inputToIso, isoToInput } from "../../lib/dateUtils";
import PersistedDateInput from "./PersistedDateInput";

type VehicleType = "truck" | "trailer";
type VehicleStatus = "active" | "inactive";

export type FleetVehicle = {
  id: string;
  type: VehicleType;
  unitNumber: string;
  vin: string;
  year?: string;
  make?: string;
  model?: string;
  plateNumber?: string;
  registrationState?: string;
  registrationExpiration?: string;
  registrationPermanent?: boolean;
  inspectionExpiration?: string;
  status?: VehicleStatus;
  inactiveAt?: unknown;
};

const emptyDraft = {
  type: "truck" as VehicleType,
  unitNumber: "",
  vin: "",
  year: "",
  make: "",
  model: "",
  plateNumber: "",
  registrationState: "",
};

export function vehicleDeadlineItems(vehicles: FleetVehicle[]) {
  return vehicles
    .filter(vehicle => vehicle.status !== "inactive")
    .flatMap(vehicle => {
      const deadlines = [
        {
          id: `vehicle:${vehicle.id}:inspection`,
          n: `${vehicle.unitNumber} — Annual DOT inspection`,
          f: vehicle.type === "truck" ? "Truck" : "Trailer",
          due: vehicle.inspectionExpiration || null,
          completed: false,
          attentionDays: 30,
          vehicleId: vehicle.id,
        },
      ];

      if (!(vehicle.type === "trailer" && vehicle.registrationPermanent === true)) {
        deadlines.unshift({
        id: `vehicle:${vehicle.id}:registration`,
        n: `${vehicle.unitNumber} — Registration`,
        f: vehicle.type === "truck" ? "Truck" : "Trailer",
        due: vehicle.registrationExpiration || null,
        completed: false,
        attentionDays: 30,
        vehicleId: vehicle.id,
        });
      }

      return deadlines;
    });
}

export default function FleetPanel() {
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [adding, setAdding] = useState(false);
  const [openVehicleId, setOpenVehicleId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    return onSnapshot(
      collection(db, "carriers", user.uid, "vehicles"),
      snapshot => {
        setVehicles(snapshot.docs.map(item => ({
          id: item.id,
          ...item.data(),
        })) as FleetVehicle[]);
      }
    );
  }, []);

  const updateVehicle = async (
    vehicleId: string,
    updates: Partial<FleetVehicle>
  ) => {
    const user = auth.currentUser;
    if (!user) return;

    await setDoc(
      doc(db, "carriers", user.uid, "vehicles", vehicleId),
      { ...updates, lastUpdated: serverTimestamp() },
      { merge: true }
    );
  };

  const addVehicle = async () => {
    const user = auth.currentUser;
    if (!user || adding) return;

    const unitNumber = draft.unitNumber.trim();
    const vin = draft.vin.trim().toUpperCase();

    if (!unitNumber) {
      showMessage("Unit number required", "Enter the truck or trailer unit number.");
      return;
    }

    if (vin.length < 5) {
      showMessage(
        "VIN or serial number required",
        "Enter the complete VIN or serial number shown on the vehicle title."
      );
      return;
    }

    if (vehicles.some(vehicle => vehicle.vin?.trim().toUpperCase() === vin)) {
      showMessage(
        "VIN or serial number already exists",
        "This VIN or serial number is already saved in your fleet."
      );
      return;
    }

    try {
      setAdding(true);
      const vehicleRef = doc(collection(db, "carriers", user.uid, "vehicles"));
      await setDoc(vehicleRef, {
        type: draft.type,
        unitNumber,
        vin,
        year: draft.year.trim(),
        make: draft.make.trim(),
        model: draft.model.trim(),
        plateNumber: draft.plateNumber.trim().toUpperCase(),
        registrationState: draft.registrationState.trim().toUpperCase(),
        registrationExpiration: "",
        registrationPermanent: false,
        inspectionExpiration: "",
        status: "active",
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
      });
      setDraft(emptyDraft);
      setOpenVehicleId(vehicleRef.id);
    } finally {
      setAdding(false);
    }
  };

  const renewDeadline = async (
    vehicle: FleetVehicle,
    field: "registrationExpiration" | "inspectionExpiration",
    completionDate?: string,
    confirmedNextDueDate?: string
  ) => {
    const currentDate = vehicle[field];
    const nextDate = field === "inspectionExpiration"
      ? confirmedNextDueDate || ""
      : currentDate
        ? addYears(currentDate, 1)
        : "";
    if (!currentDate || !nextDate) return;

    const user = auth.currentUser;
    if (!user) return;

    const vehicleRef = doc(db, "carriers", user.uid, "vehicles", vehicle.id);
    const historyRef = doc(collection(vehicleRef, "complianceRecords", field, "history"));
    const batch = writeBatch(db);

    batch.set(vehicleRef, {
      [field]: nextDate,
      lastUpdated: serverTimestamp(),
    }, { merge: true });
    batch.set(historyRef, {
      requirementId: field,
      completionDate: completionDate || null,
      previousDueDate: currentDate,
      nextDueDate: nextDate,
      completedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  };

  const archiveVehicle = (vehicle: FleetVehicle) => {
    confirmAction(
      "Mark vehicle sold or removed?",
      `${vehicle.unitNumber} will leave the active fleet. Its information and history will be preserved.`,
      "Mark Sold or Removed",
      async () => {
        await updateVehicle(vehicle.id, {
          status: "inactive",
          inactiveAt: serverTimestamp(),
        });
        setOpenVehicleId(null);
      }
    );
  };

  const permanentlyDeleteVehicle = (vehicle: FleetVehicle) => {
    confirmAction(
      "Permanently delete vehicle?",
      `${vehicle.unitNumber} and its saved deadline history will be permanently deleted. This cannot be undone.`,
      "Permanently Delete",
      async () => {
        const user = auth.currentUser;
        if (!user) return;
        const vehicleRef = doc(db, "carriers", user.uid, "vehicles", vehicle.id);
        const batch = writeBatch(db);

        for (const requirementId of ["registrationExpiration", "inspectionExpiration"]) {
          const history = await getDocs(collection(vehicleRef, "complianceRecords", requirementId, "history"));
          history.docs.forEach(record => batch.delete(record.ref));
        }
        batch.delete(vehicleRef);
        await batch.commit();
        setOpenVehicleId(null);
      }
    );
  };

  const active = vehicles.filter(vehicle => vehicle.status !== "inactive");
  const trucks = active.filter(vehicle => vehicle.type === "truck");
  const trailers = active.filter(vehicle => vehicle.type === "trailer");
  const inactive = vehicles.filter(vehicle => vehicle.status === "inactive");

  return (
    <View style={styles.panel}>
      <View style={styles.headingRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.pageTitle}>Fleet</Text>
          <Text style={styles.pageDescription}>
            Keep registration and annual inspection dates clear for every truck and trailer.
          </Text>
        </View>
      </View>

      <VehicleSection
        title="Trucks"
        count={trucks.length}
        emptyText="No active trucks have been added."
        vehicles={trucks}
        openVehicleId={openVehicleId}
        setOpenVehicleId={setOpenVehicleId}
        updateVehicle={updateVehicle}
        renewDeadline={renewDeadline}
        archiveVehicle={archiveVehicle}
      />

      <VehicleSection
        title="Trailers"
        count={trailers.length}
        emptyText="No active trailers have been added."
        vehicles={trailers}
        openVehicleId={openVehicleId}
        setOpenVehicleId={setOpenVehicleId}
        updateVehicle={updateVehicle}
        renewDeadline={renewDeadline}
        archiveVehicle={archiveVehicle}
      />

      <View style={styles.addCard}>
        <Text style={styles.addTitle}>Add a truck or trailer</Text>
        <View style={styles.typePicker}>
          {(["truck", "trailer"] as VehicleType[]).map(type => (
            <TouchableOpacity
              key={type}
              onPress={() => setDraft(current => ({ ...current, type }))}
              style={[styles.typeButton, draft.type === type && styles.typeButtonActive]}
            >
              <Text style={[styles.typeButtonText, draft.type === type && styles.typeButtonTextActive]}>
                {type === "truck" ? "Truck" : "Trailer"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <EntryField label="Unit number" value={draft.unitNumber} placeholder="e.g., 101 or T-12" onChangeText={value => setDraft(current => ({ ...current, unitNumber: value }))} />
        <EntryField label="VIN or serial number" value={draft.vin} placeholder="As shown on the title" maxLength={17} onChangeText={value => setDraft(current => ({ ...current, vin: value.toUpperCase() }))} />
        <Text style={styles.vinHelp}>Older vehicles may have a shorter VIN.</Text>

        <Text style={styles.optionalLabel}>Optional details</Text>
        <View style={styles.optionalGrid}>
          <EntryField label="Year" value={draft.year} placeholder="2024" width={110} onChangeText={value => setDraft(current => ({ ...current, year: value }))} />
          <EntryField label="Make" value={draft.make} placeholder="Freightliner" width={180} onChangeText={value => setDraft(current => ({ ...current, make: value }))} />
          <EntryField label="Model" value={draft.model} placeholder="Cascadia" width={180} onChangeText={value => setDraft(current => ({ ...current, model: value }))} />
          <EntryField label="Plate" value={draft.plateNumber} placeholder="Plate number" width={160} onChangeText={value => setDraft(current => ({ ...current, plateNumber: value }))} />
          <EntryField label="State" value={draft.registrationState} placeholder="WA" width={90} maxLength={2} onChangeText={value => setDraft(current => ({ ...current, registrationState: value.toUpperCase() }))} />
        </View>

        <TouchableOpacity disabled={adding} onPress={addVehicle} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>{adding ? "Adding…" : `Add ${draft.type === "truck" ? "Truck" : "Trailer"}`}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.inactiveSection}>
        <TouchableOpacity onPress={() => setShowInactive(current => !current)} style={styles.inactiveHeader}>
          <View>
            <Text style={styles.inactiveTitle}>Sold or removed</Text>
            <Text style={styles.inactiveCount}>{inactive.length} saved</Text>
          </View>
          <Text style={styles.inactiveToggle}>{showInactive ? "Hide" : "View"}</Text>
        </TouchableOpacity>

        {showInactive && inactive.map(vehicle => (
          <View key={vehicle.id} style={styles.inactiveCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inactiveUnit}>{vehicle.unitNumber}</Text>
              <Text style={styles.vehicleIdentity}>{vehicle.type === "truck" ? "TRUCK" : "TRAILER"} · VIN ending {vehicle.vin?.slice(-6) || "—"}</Text>
            </View>
            <TouchableOpacity onPress={() => updateVehicle(vehicle.id, { status: "active", inactiveAt: null })} style={styles.restoreButton}>
              <Text style={styles.restoreButtonText}>Return to Active</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => permanentlyDeleteVehicle(vehicle)} style={styles.deleteLink}>
              <Text style={styles.deleteLinkText}>Permanently delete</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </View>
  );
}

function VehicleSection(props: {
  title: string;
  count: number;
  emptyText: string;
  vehicles: FleetVehicle[];
  openVehicleId: string | null;
  setOpenVehicleId: (id: string | null) => void;
  updateVehicle: (id: string, updates: Partial<FleetVehicle>) => Promise<void>;
  renewDeadline: (vehicle: FleetVehicle, field: "registrationExpiration" | "inspectionExpiration", completionDate?: string, nextDueDate?: string) => Promise<void>;
  archiveVehicle: (vehicle: FleetVehicle) => void;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{props.title}</Text>
        <Text style={styles.sectionCount}>{props.count} active</Text>
      </View>
      {props.vehicles.length === 0 ? (
        <Text style={styles.emptyText}>{props.emptyText}</Text>
      ) : props.vehicles.map(vehicle => (
        <VehicleCard key={vehicle.id} vehicle={vehicle} open={props.openVehicleId === vehicle.id} onToggle={() => props.setOpenVehicleId(props.openVehicleId === vehicle.id ? null : vehicle.id)} updateVehicle={props.updateVehicle} renewDeadline={props.renewDeadline} archiveVehicle={props.archiveVehicle} />
      ))}
    </View>
  );
}

function VehicleCard(props: {
  vehicle: FleetVehicle;
  open: boolean;
  onToggle: () => void;
  updateVehicle: (id: string, updates: Partial<FleetVehicle>) => Promise<void>;
  renewDeadline: (vehicle: FleetVehicle, field: "registrationExpiration" | "inspectionExpiration", completionDate?: string, nextDueDate?: string) => Promise<void>;
  archiveVehicle: (vehicle: FleetVehicle) => void;
}) {
  const { vehicle } = props;
  const [details, setDetails] = useState({
    type: vehicle.type,
    unitNumber: vehicle.unitNumber,
    vin: vehicle.vin,
    year: vehicle.year || "",
    make: vehicle.make || "",
    model: vehicle.model || "",
    plateNumber: vehicle.plateNumber || "",
    registrationState: vehicle.registrationState || "",
  });
  const [detailsSaved, setDetailsSaved] = useState(false);

  const saveDetails = async () => {
    const unitNumber = details.unitNumber.trim();
    const vin = details.vin.trim().toUpperCase();

    if (!unitNumber) {
      showMessage("Unit number required", "Enter the truck or trailer unit number.");
      return;
    }

    if (vin.length < 5) {
      showMessage(
        "VIN or serial number required",
        "Enter the complete VIN or serial number shown on the vehicle title."
      );
      return;
    }

    await props.updateVehicle(vehicle.id, {
      ...details,
      unitNumber,
      vin,
      plateNumber: details.plateNumber.trim().toUpperCase(),
      registrationState: details.registrationState.trim().toUpperCase(),
      ...(details.type === "truck" ? { registrationPermanent: false } : {}),
    });
    setDetailsSaved(true);
    setTimeout(() => setDetailsSaved(false), 1500);
  };

  return (
    <View style={[styles.vehicleCard, props.open && styles.vehicleCardOpen]}>
      <TouchableOpacity onPress={props.onToggle} activeOpacity={0.8} style={styles.vehicleHeader}>
        <View style={styles.typeBadge}><Text style={styles.typeBadgeText}>{vehicle.type === "truck" ? "TRUCK" : "TRAILER"}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.unitNumber}>Unit {vehicle.unitNumber}</Text>
          <Text style={styles.vehicleIdentity}>VIN ending {vehicle.vin?.slice(-6) || "—"}</Text>
        </View>
        <Text style={styles.expandIcon}>{props.open ? "⌃" : "⌄"}</Text>
      </TouchableOpacity>

      <View style={styles.deadlineSummary}>
        <DeadlineSummary
          label="Registration"
          date={vehicle.registrationExpiration || ""}
          permanent={vehicle.type === "trailer" && vehicle.registrationPermanent === true}
        />
        <View style={styles.summaryDivider} />
        <DeadlineSummary label="Annual inspection" date={vehicle.inspectionExpiration || ""} />
      </View>

      {props.open && (
        <View style={styles.editArea}>
          <Text style={styles.editSectionTitle}>Vehicle information</Text>
          <View style={styles.typePickerCompact}>
            {(["truck", "trailer"] as VehicleType[]).map(type => (
              <TouchableOpacity
                key={type}
                onPress={() => setDetails(current => ({ ...current, type }))}
                style={[styles.typeButtonCompact, details.type === type && styles.typeButtonActive]}
              >
                <Text style={[styles.typeButtonText, details.type === type && styles.typeButtonTextActive]}>
                  {type === "truck" ? "Truck" : "Trailer"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <EntryField label="Unit number" value={details.unitNumber} placeholder="Unit number" onChangeText={unitNumber => setDetails(current => ({ ...current, unitNumber }))} />
          <EntryField label="VIN or serial number" value={details.vin} placeholder="As shown on the title" maxLength={17} onChangeText={vin => setDetails(current => ({ ...current, vin: vin.toUpperCase() }))} />
          <Text style={styles.vinHelp}>Older vehicles may have a shorter VIN.</Text>
          <View style={styles.optionalGrid}>
            <EntryField label="Year" value={details.year} placeholder="Year" width={100} onChangeText={year => setDetails(current => ({ ...current, year }))} />
            <EntryField label="Make" value={details.make} placeholder="Make" width={160} onChangeText={make => setDetails(current => ({ ...current, make }))} />
            <EntryField label="Model" value={details.model} placeholder="Model" width={160} onChangeText={model => setDetails(current => ({ ...current, model }))} />
            <EntryField label="Plate" value={details.plateNumber} placeholder="Plate" width={150} onChangeText={plateNumber => setDetails(current => ({ ...current, plateNumber }))} />
            <EntryField label="State" value={details.registrationState} placeholder="WA" width={90} maxLength={2} onChangeText={registrationState => setDetails(current => ({ ...current, registrationState: registrationState.toUpperCase() }))} />
          </View>

          <TouchableOpacity onPress={saveDetails} style={styles.saveDetailsButton}>
            <Text style={styles.saveDetailsButtonText}>{detailsSaved ? "Saved" : "Save Vehicle Information"}</Text>
          </TouchableOpacity>

          <Text style={styles.editSectionTitle}>Tracked deadlines</Text>
          {vehicle.type === "trailer" ? (
            <View style={styles.registrationTypeArea}>
              <Text style={styles.deadlineLabel}>Registration / license plate</Text>
              <View style={styles.registrationTypePicker}>
                <TouchableOpacity
                  onPress={() => props.updateVehicle(vehicle.id, { registrationPermanent: false })}
                  style={[styles.registrationTypeButton, vehicle.registrationPermanent !== true && styles.registrationTypeButtonActive]}
                >
                  <Text style={[styles.registrationTypeText, vehicle.registrationPermanent !== true && styles.registrationTypeTextActive]}>Expires</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => props.updateVehicle(vehicle.id, { registrationPermanent: true })}
                  style={[styles.registrationTypeButton, vehicle.registrationPermanent === true && styles.registrationTypeButtonActive]}
                >
                  <Text style={[styles.registrationTypeText, vehicle.registrationPermanent === true && styles.registrationTypeTextActive]}>Permanent</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.permanentHelp}>
                Permanent registration has no expiration while ownership remains unchanged. Registration reminders stop, but inspection reminders continue.
              </Text>
            </View>
          ) : null}
          {!(vehicle.type === "trailer" && vehicle.registrationPermanent === true) ? (
            <DeadlineEditor vehicleId={vehicle.id} field="registrationExpiration" label="Registration expiration" value={vehicle.registrationExpiration || ""} mode="anchored" onSave={registrationExpiration => props.updateVehicle(vehicle.id, { registrationExpiration })} onComplete={() => props.renewDeadline(vehicle, "registrationExpiration")} />
          ) : (
            <View style={styles.permanentStatus}><Text style={styles.permanentStatusText}>Permanent — no expiration</Text></View>
          )}
          <DeadlineEditor vehicleId={vehicle.id} field="inspectionExpiration" label="Annual DOT inspection expiration / next due date" value={vehicle.inspectionExpiration || ""} mode="rolling" onSave={inspectionExpiration => props.updateVehicle(vehicle.id, { inspectionExpiration })} onComplete={(completionDate, nextDueDate) => props.renewDeadline(vehicle, "inspectionExpiration", completionDate, nextDueDate)} />

          <View style={styles.removeArea}>
            <TouchableOpacity onPress={() => props.archiveVehicle(vehicle)} style={styles.removeButton}>
              <Text style={styles.removeButtonText}>Mark Sold or Removed</Text>
            </TouchableOpacity>
            <Text style={styles.removeHelp}>Stops reminders while preserving this vehicle and its history.</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function DeadlineSummary({ label, date, permanent = false }: { label: string; date: string; permanent?: boolean }) {
  const days = daysFrom(date || null);
  const status = !date || days === null
    ? { text: "Needs date", color: "#A32D2D", bg: "#FCEBEB" }
    : days < 0
      ? { text: `${Math.abs(days)} overdue`, color: "#A32D2D", bg: "#FCEBEB" }
      : days <= 30
        ? { text: `${days} days`, color: "#854F0B", bg: "#FAEEDA" }
        : days <= 90
          ? { text: `${days} days`, color: "#185FA5", bg: "#E6F1FB" }
          : { text: `${days} days`, color: "#3B6D11", bg: "#EAF3DE" };

  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <View style={[styles.summaryBadge, { backgroundColor: permanent ? "#EAF3DE" : status.bg }]}>
        <Text style={[styles.summaryBadgeText, { color: permanent ? "#27500A" : status.color }]}>
          {permanent ? "Permanent" : days === 0 && date ? "Due today" : status.text}
        </Text>
      </View>
      {!permanent && date ? <Text style={styles.summaryDate}>{fmtDate(date)}</Text> : null}
    </View>
  );
}

function DeadlineEditor(props: {
  vehicleId: string;
  field: "registrationExpiration" | "inspectionExpiration";
  label: string;
  value: string;
  mode: "anchored" | "rolling";
  onSave: (date: string) => Promise<void>;
  onComplete: (completionDate?: string, nextDueDate?: string) => Promise<void>;
}) {
  const today = localDateString();
  const [confirming, setConfirming] = useState(false);
  const [completionDate, setCompletionDate] = useState(isoToInput(today));
  const isoCompletionDate = inputToIso(completionDate);
  const [nextDueDate, setNextDueDate] = useState("");
  const isoNextDueDate = inputToIso(nextDueDate);
  const nextDate = props.mode === "rolling"
    ? isoNextDueDate
    : props.value
      ? addYears(props.value, 1)
      : "";

  return (
    <View style={styles.deadlineEditor}>
      <View style={styles.deadlineLabelRow}>
        <Text style={styles.deadlineLabel}>{props.label}</Text>
        <DeadlineBadge date={props.value} />
      </View>
      <PersistedDateInput value={props.value} onSave={props.onSave} accessibilityLabel={props.label} />
      <Text style={styles.formatHelp}>Format: MM-DD-YYYY</Text>

      {props.value && !confirming ? (
        <TouchableOpacity
          onPress={() => {
            setCompletionDate(isoToInput(today));
            setNextDueDate(isoToInput(addYears(today, 1)));
            setConfirming(true);
          }}
          style={styles.renewButton}
        >
          <Text style={styles.renewButtonText}>
            {props.mode === "rolling" ? "Mark Inspection Complete" : "Mark Renewed"}
          </Text>
        </TouchableOpacity>
      ) : null}

      {confirming ? (
        <View style={styles.confirmArea}>
          {props.mode === "rolling" ? (
            <>
              <Text style={styles.fieldLabel}>Inspection completion date</Text>
              <TextInput
                accessibilityLabel="Inspection completion date"
                placeholder="MM-DD-YYYY"
                value={completionDate}
                onChangeText={text => {
                  const formatted = formatDateInput(text);
                  setCompletionDate(formatted);
                  const iso = inputToIso(formatted);
                  if (iso) setNextDueDate(isoToInput(addYears(iso, 1)));
                }}
                keyboardType="number-pad"
                maxLength={10}
                style={[styles.input, { width: 160 }]}
              />
              <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Next inspection expiration / due date</Text>
              <TextInput
                accessibilityLabel="Next inspection expiration or due date"
                placeholder="MM-DD-YYYY"
                value={nextDueDate}
                onChangeText={text => setNextDueDate(formatDateInput(text))}
                keyboardType="number-pad"
                maxLength={10}
                style={[styles.input, { width: 160 }]}
              />
              <Text style={styles.formatHelp}>
                Confirm the actual next date shown by the inspection document or applicable program.
              </Text>
            </>
          ) : null}

          <Text style={styles.confirmText}>
            The next date will change from {fmtDate(props.value)} to {fmtDate(nextDate)}.
          </Text>

          <View style={styles.confirmButtons}>
            <TouchableOpacity onPress={() => setConfirming(false)} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={!nextDate || (props.mode === "rolling" && (!isoCompletionDate || !isoNextDueDate || isoNextDueDate <= isoCompletionDate))}
              onPress={async () => {
                await props.onComplete(
                  props.mode === "rolling" ? isoCompletionDate : undefined,
                  props.mode === "rolling" ? isoNextDueDate : undefined
                );
                setConfirming(false);
              }}
              style={styles.confirmButton}
            >
              <Text style={styles.confirmButtonText}>
                {props.mode === "rolling" ? "Mark Inspection Complete" : "Mark Renewed"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <VehicleDeadlineHistory
        vehicleId={props.vehicleId}
        field={props.field}
      />
    </View>
  );
}

type VehicleHistoryRecord = {
  id: string;
  completionDate?: string | null;
  previousDueDate?: string | null;
  nextDueDate?: string | null;
  completedAt?: any;
  createdAt?: any;
};

function VehicleDeadlineHistory({
  vehicleId,
  field,
}: {
  vehicleId: string;
  field: "registrationExpiration" | "inspectionExpiration";
}) {
  const [records, setRecords] = useState<VehicleHistoryRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const historyRef = collection(
      db,
      "carriers",
      user.uid,
      "vehicles",
      vehicleId,
      "complianceRecords",
      field,
      "history"
    );

    return onSnapshot(historyRef, snapshot => {
      const loaded = snapshot.docs.map(item => ({
        id: item.id,
        ...item.data(),
      })) as VehicleHistoryRecord[];

      loaded.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || a.completedAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || b.completedAt?.toMillis?.() || 0;
        return bTime - aTime;
      });

      setRecords(loaded);
    });
  }, [field, vehicleId]);

  if (records.length === 0) {
    return null;
  }

  const deleteRecord = (record: VehicleHistoryRecord) => {
    const performDelete = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        setDeletingId(record.id);

        const vehicleRef = doc(db, "carriers", user.uid, "vehicles", vehicleId);
        const recordRef = doc(
          db,
          "carriers",
          user.uid,
          "vehicles",
          vehicleId,
          "complianceRecords",
          field,
          "history",
          record.id
        );

        const isNewest = records[0]?.id === record.id;

        if (!isNewest) {
          await deleteDoc(recordRef);
          return;
        }

        const vehicleSnapshot = await getDoc(vehicleRef);
        const liveDate = vehicleSnapshot.data()?.[field];

        if (!record.nextDueDate || liveDate !== record.nextDueDate) {
          await deleteDoc(recordRef);
          return;
        }

        const batch = writeBatch(db);
        batch.set(vehicleRef, {
          [field]: record.previousDueDate || "",
          lastUpdated: serverTimestamp(),
        }, { merge: true });
        batch.delete(recordRef);
        await batch.commit();
      } finally {
        setDeletingId(null);
      }
    };

    confirmAction(
      "Delete history record?",
      records[0]?.id === record.id
        ? "If this is still the active renewal, the vehicle deadline will return to its previous date. This cannot be undone."
        : "This removes the saved history entry without changing the current vehicle deadline. This cannot be undone.",
      "Delete Record",
      performDelete
    );
  };

  return (
    <View style={styles.historyArea}>
      <TouchableOpacity
        onPress={() => setOpen(current => !current)}
        style={styles.historyToggle}
      >
        <Text style={styles.historyToggleText}>
          {open ? "Hide history" : `View history (${records.length})`}
        </Text>
      </TouchableOpacity>

      {open ? (
        <View style={styles.historyList}>
          {records.map((record, index) => {
            const recordedDate =
              record.completionDate ||
              record.createdAt?.toDate?.().toISOString?.().slice(0, 10) ||
              record.completedAt?.toDate?.().toISOString?.().slice(0, 10) ||
              "";

            return (
              <View
                key={record.id}
                style={[
                  styles.historyRecord,
                  index === records.length - 1 && styles.historyRecordLast,
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyTitle}>
                    {field === "inspectionExpiration"
                      ? `Inspection completed ${fmtDate(recordedDate)}`
                      : `Renewal recorded ${fmtDate(recordedDate)}`}
                  </Text>
                  <Text style={styles.historyDates}>
                    {fmtDate(record.previousDueDate || null)} → {fmtDate(record.nextDueDate || null)}
                  </Text>
                </View>

                <TouchableOpacity
                  disabled={deletingId === record.id}
                  onPress={() => deleteRecord(record)}
                  style={styles.historyDeleteButton}
                >
                  <Text style={styles.historyDeleteText}>
                    {deletingId === record.id ? "Deleting…" : "Delete"}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function DeadlineBadge({ date }: { date: string }) {
  const days = daysFrom(date || null);
  const status = !date || days === null
    ? { text: "Needs date", color: "#A32D2D", bg: "#FCEBEB" }
    : days < 0
      ? { text: `${Math.abs(days)} overdue`, color: "#A32D2D", bg: "#FCEBEB" }
      : days <= 30
        ? { text: `${days} days`, color: "#854F0B", bg: "#FAEEDA" }
        : days <= 90
          ? { text: `${days} days`, color: "#185FA5", bg: "#E6F1FB" }
          : { text: `${days} days`, color: "#3B6D11", bg: "#EAF3DE" };

  return (
    <View style={[styles.deadlineBadge, { backgroundColor: status.bg }]}>
      <Text style={[styles.deadlineBadgeText, { color: status.color }]}>{status.text}</Text>
    </View>
  );
}

function EntryField(props: { label: string; value: string; placeholder: string; onChangeText: (value: string) => void; width?: number; maxLength?: number }) {
  return (
    <View style={styles.entryField}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <TextInput accessibilityLabel={props.label} value={props.value} placeholder={props.placeholder} placeholderTextColor="#8A8880" onChangeText={props.onChangeText} maxLength={props.maxLength} autoCapitalize="characters" autoCorrect={false} style={[styles.input, { width: props.width || 280 }]} />
    </View>
  );
}

function showMessage(title: string, message: string) {
  if (Platform.OS === "web") window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

function confirmAction(title: string, message: string, actionLabel: string, action: () => void | Promise<void>) {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n\n${message}`)) void action();
    return;
  }
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: actionLabel, style: "destructive", onPress: () => void action() },
  ]);
}

const styles = StyleSheet.create({
  panel: { padding: 16, backgroundColor: "#F7F6F3", borderRadius: 14 },
  headingRow: { marginBottom: 16 },
  pageTitle: { fontSize: 18, fontWeight: "600", color: "#1A1915" },
  pageDescription: { marginTop: 4, maxWidth: 620, fontSize: 12, lineHeight: 18, color: "#706E68" },
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 8 },
  sectionTitle: { fontSize: 11, fontWeight: "700", color: "#706E68", textTransform: "uppercase", letterSpacing: 0.6 },
  sectionCount: { fontSize: 11, fontWeight: "600", color: "#8A8880" },
  emptyText: { padding: 12, fontSize: 13, color: "#706E68", borderWidth: 1, borderColor: "#E8E6E0", borderRadius: 8, backgroundColor: "#FFFFFF" },
  vehicleCard: { marginBottom: 8, borderWidth: 1, borderColor: "#E8E6E0", borderRadius: 8, backgroundColor: "#FFFFFF", overflow: "hidden" },
  vehicleCardOpen: { borderColor: "#C9D9B8" },
  vehicleHeader: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 10, padding: 12, backgroundColor: "#FFFFFF" },
  typeBadge: { minWidth: 58, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: "#EAF3DE", alignItems: "center" },
  typeBadgeText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: "#3B6D11" },
  unitNumber: { fontSize: 16, lineHeight: 21, fontWeight: "600", color: "#1A1915" },
  vehicleIdentity: { marginTop: 2, fontSize: 12, fontWeight: "400", color: "#706E68" },
  expandIcon: { fontSize: 18, fontWeight: "600", color: "#706E68" },
  deadlineSummary: { flexDirection: "row", paddingVertical: 12, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: "#E8E6E0" },
  summaryItem: { flex: 1 },
  summaryDivider: { width: 1, marginHorizontal: 14, backgroundColor: "#E2E0D8" },
  summaryLabel: { fontSize: 12, fontWeight: "400", color: "#706E68" },
  summaryBadge: { alignSelf: "flex-start", marginTop: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14 },
  summaryBadgeText: { fontSize: 11, fontWeight: "600" },
  summaryDate: { marginTop: 4, fontSize: 11, color: "#8A8880" },
  editArea: { padding: 12, borderTopWidth: 1, borderTopColor: "#E8E6E0", backgroundColor: "#FFFFFF" },
  editSectionTitle: { marginTop: 4, marginBottom: 10, fontSize: 11, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", color: "#706E68" },
  entryField: { marginBottom: 12 },
  fieldLabel: { marginBottom: 5, fontSize: 12, fontWeight: "600", color: "#5F5D57" },
  vinHelp: { marginTop: -7, marginBottom: 12, fontSize: 11, lineHeight: 16, color: "#706E68" },
  input: { maxWidth: "100%", minHeight: 40, paddingHorizontal: 11, borderWidth: 1, borderColor: "#D3D1C7", borderRadius: 8, backgroundColor: "#FFFFFF", color: "#1A1915" },
  optionalGrid: { flexDirection: "row", flexWrap: "wrap", columnGap: 12 },
  optionalLabel: { marginTop: 4, marginBottom: 10, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.7, color: "#706E68" },
  deadlineEditor: { marginBottom: 14 },
  registrationTypeArea: { marginBottom: 10 },
  registrationTypePicker: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 5 },
  registrationTypeButton: { paddingHorizontal: 13, paddingVertical: 8, borderWidth: 1, borderColor: "#C9C7BF", borderRadius: 8, backgroundColor: "#FFFFFF" },
  registrationTypeButtonActive: { borderColor: "#27500A", backgroundColor: "#EAF3DE" },
  registrationTypeText: { fontSize: 12, fontWeight: "700", color: "#706E68" },
  registrationTypeTextActive: { color: "#27500A" },
  permanentHelp: { marginTop: 7, maxWidth: 520, fontSize: 11, lineHeight: 16, color: "#706E68" },
  permanentStatus: { alignSelf: "flex-start", marginBottom: 14, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 8, backgroundColor: "#EAF3DE" },
  permanentStatusText: { fontSize: 12, fontWeight: "700", color: "#27500A" },
  deadlineEditorRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", gap: 8 },
  deadlineLabelRow: { width: "100%", flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 },
  deadlineLabel: { flex: 1, paddingRight: 8, fontSize: 12, color: "#706E68" },
  deadlineBadge: { flexShrink: 0, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14 },
  deadlineBadgeText: { fontSize: 11, fontWeight: "600" },
  formatHelp: { marginTop: 4, fontSize: 11, color: "#8A8880" },
  renewButton: { alignSelf: "flex-start", marginTop: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "#C0DD97", borderRadius: 6, backgroundColor: "#EAF3DE" },
  renewButtonText: { fontSize: 12, fontWeight: "600", color: "#27500A" },
  confirmArea: { marginTop: 8 },
  confirmText: { marginTop: 8, fontSize: 12, lineHeight: 18, color: "#706E68" },
  confirmButtons: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  cancelButton: { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "#D3D1C7", borderRadius: 6, backgroundColor: "#FFFFFF" },
  cancelButtonText: { fontSize: 12, color: "#706E68" },
  confirmButton: { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "#C0DD97", borderRadius: 6, backgroundColor: "#EAF3DE" },
  confirmButtonText: { fontSize: 12, fontWeight: "600", color: "#27500A" },
  historyArea: { marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E8E6E0" },
  historyToggle: { alignSelf: "flex-start", paddingVertical: 4 },
  historyToggleText: { fontSize: 11, fontWeight: "600", color: "#27500A" },
  historyList: { marginTop: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: "#E8E6E0", borderRadius: 8, backgroundColor: "#FAFAF8" },
  historyRecord: { minHeight: 55, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E8E6E0" },
  historyRecordLast: { borderBottomWidth: 0 },
  historyTitle: { fontSize: 11, fontWeight: "600", color: "#45433F" },
  historyDates: { marginTop: 3, fontSize: 10, color: "#706E68" },
  historyDeleteButton: { paddingHorizontal: 8, paddingVertical: 6 },
  historyDeleteText: { fontSize: 10, fontWeight: "600", color: "#A32D2D" },
  removeArea: { marginTop: 8, paddingTop: 15, borderTopWidth: 1, borderTopColor: "#E8E6E0" },
  removeButton: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: "#E8B4B4", borderRadius: 8, backgroundColor: "#FCEBEB" },
  removeButtonText: { fontSize: 12, fontWeight: "700", color: "#A32D2D" },
  removeHelp: { marginTop: 6, fontSize: 11, lineHeight: 16, color: "#706E68" },
  addCard: { marginTop: 4, marginBottom: 20, padding: 12, borderWidth: 1, borderColor: "#E8E6E0", borderRadius: 8, backgroundColor: "#FFFFFF" },
  addTitle: { fontSize: 16, fontWeight: "600", color: "#1A1915" },
  typePicker: { flexDirection: "row", gap: 8, marginTop: 14, marginBottom: 16 },
  typePickerCompact: { flexDirection: "row", gap: 8, marginBottom: 14 },
  typeButton: { minWidth: 100, paddingHorizontal: 16, paddingVertical: 10, alignItems: "center", borderWidth: 1, borderColor: "#C9C7BF", borderRadius: 8, backgroundColor: "#FFFFFF" },
  typeButtonCompact: { minWidth: 90, paddingHorizontal: 13, paddingVertical: 8, alignItems: "center", borderWidth: 1, borderColor: "#C9C7BF", borderRadius: 8, backgroundColor: "#FFFFFF" },
  typeButtonActive: { borderColor: "#27500A", backgroundColor: "#EAF3DE" },
  typeButtonText: { fontSize: 13, fontWeight: "700", color: "#706E68" },
  typeButtonTextActive: { color: "#27500A" },
  primaryButton: { alignSelf: "flex-start", minWidth: 130, minHeight: 42, marginTop: 4, paddingHorizontal: 16, justifyContent: "center", alignItems: "center", borderRadius: 8, backgroundColor: "#27500A" },
  primaryButtonText: { fontSize: 13, fontWeight: "800", color: "#FFFFFF" },
  saveDetailsButton: { alignSelf: "flex-start", minHeight: 38, marginBottom: 20, paddingHorizontal: 14, justifyContent: "center", borderRadius: 8, backgroundColor: "#27500A" },
  saveDetailsButtonText: { fontSize: 12, fontWeight: "800", color: "#FFFFFF" },
  inactiveSection: { marginTop: 2, marginBottom: 20, borderTopWidth: 1, borderTopColor: "#D8D6CE" },
  inactiveHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14 },
  inactiveTitle: { fontSize: 15, fontWeight: "800", color: "#55534E" },
  inactiveCount: { marginTop: 2, fontSize: 11, color: "#8A8880" },
  inactiveToggle: { fontSize: 12, fontWeight: "700", color: "#27500A" },
  inactiveCard: { marginBottom: 8, padding: 12, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#E2E0D8", borderRadius: 9, backgroundColor: "#F4F3EF" },
  inactiveUnit: { fontSize: 15, fontWeight: "800", color: "#55534E" },
  restoreButton: { paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: "#BFC9B5", borderRadius: 7, backgroundColor: "#FFFFFF" },
  restoreButtonText: { fontSize: 11, fontWeight: "700", color: "#27500A" },
  deleteLink: { padding: 7 },
  deleteLinkText: { fontSize: 11, fontWeight: "600", color: "#A32D2D", textDecorationLine: "underline" },
});
