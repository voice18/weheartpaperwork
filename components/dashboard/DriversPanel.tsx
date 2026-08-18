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
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";

import { auth, db } from "../../lib/firebase";
import PersistedDateInput from "./PersistedDateInput";
import DriverRenewalField from "./DriverRenewalField";
import { daysFrom } from "../../lib/requirements";

type Driver = {
  id: string;
  name: string;
  cdlNumber?: string;
  cdlClass: string;
  cdlState: string;
  cdlExpiration: string;
  medicalExpiration: string;
  mvrDue: string;
  clearinghouseDue: string;
  roadTestOnFile: boolean;
  employmentApplicationOnFile?: boolean;
  initialMvrOnFile?: boolean;

  speStatus?:
    | "missing"
    | "on_file"
    | "not_applicable";

  lcvStatus?:
  | "missing"
  | "on_file"
  | "not_applicable";
  previousEmployerInvestigationComplete?: boolean;
  status?: "active" | "inactive";
  inactiveAt?: unknown;
  rehiredAt?: unknown;
};

function normalizeCdlNumber(value: string) {
  return value.trim().toUpperCase().replace(/[\s-]/g, "");
}

type DriverEntryFieldProps = {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  width: number;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoCorrect?: boolean;
  maxLength?: number;
};

function DriverEntryField({
  label,
  placeholder,
  value,
  onChangeText,
  width,
  autoCapitalize,
  autoCorrect = false,
  maxLength,
}: DriverEntryFieldProps) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text
        style={{
          fontSize: 12,
          color: "#706E68",
          marginBottom: 4,
          fontWeight: "500",
        }}
      >
        {label}
      </Text>

      <TextInput
        accessibilityLabel={label}
        placeholder={placeholder}
        placeholderTextColor="#706E68"
        value={value}
        onChangeText={onChangeText}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        maxLength={maxLength}
        style={{
          width,
          backgroundColor: "#fff",
          color: "#2B2A27",
          borderWidth: 1,
          borderColor: "#D3D1C7",
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 8,
        }}
      />
    </View>
  );
}

export default function DriversPanel() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [newDriverName, setNewDriverName] = useState("");
  const [newDriverNumber, setNewDriverNumber] = useState("");
  const [newDriverClass, setNewDriverClass] = useState("");
  const [newDriverState, setNewDriverState] = useState("");
  const [openDriverId, setOpenDriverId] = useState<string | null>(null);
  const [isAddingDriver, setIsAddingDriver] = useState(false);
  const [openDqDriverId, setOpenDqDriverId] =
  useState<string | null>(null);

  const [
  openDqHelpDriverId,
  setOpenDqHelpDriverId,
] = useState<string | null>(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const driversRef = collection(db, "carriers", user.uid, "drivers");

    const unsubscribe = onSnapshot(driversRef, (snapshot) => {
      const loadedDrivers = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Driver[];

      setDrivers(
        loadedDrivers.filter((driver) => driver.status !== "inactive")
      );
    });

    return unsubscribe;
  }, []);

  const updateDriver = async (
    driverId: string,
    updates: Partial<Driver>
  ) => {
    const user = auth.currentUser;
    if (!user) return;

    await setDoc(
      doc(db, "carriers", user.uid, "drivers", driverId),
      updates,
      { merge: true }
    );
  };
    const getDqConfirmedCount = (
  driver: Driver
) => {
 const checks = [
  driver.employmentApplicationOnFile === true,
  driver.initialMvrOnFile === true,
  driver.roadTestOnFile === true,

  driver.speStatus === "on_file" ||
    driver.speStatus === "not_applicable",

  driver.lcvStatus === "on_file" ||
    driver.lcvStatus === "not_applicable",
];

  return checks.filter(Boolean).length;
};

    const markDriverRequirementComplete = async (
  driver: Driver,
  requirementId: "medical" | "mvr" | "clearinghouse",
  fieldName: "medicalExpiration" | "mvrDue" | "clearinghouseDue",
  completionDate: string,
  nextDueDate: string
) => {
  const user = auth.currentUser;

  if (!user) {
    return;
  }

  const driverRef = doc(
    db,
    "carriers",
    user.uid,
    "drivers",
    driver.id
  );

  const historyRef = doc(
    collection(
      db,
      "carriers",
      user.uid,
      "drivers",
      driver.id,
      "complianceRecords",
      requirementId,
      "history"
    )
  );

  const previousCompletionDate =
    driver[fieldName] || null;

  const batch = writeBatch(db);

  batch.set(
    driverRef,
    {
      [fieldName]:
        requirementId === "medical"
          ? nextDueDate
          : completionDate,
      lastUpdated: serverTimestamp(),
    },
    {
      merge: true,
    }
  );

  batch.set(historyRef, {
    recordType: "completion",
    source: "driver",

    carrierId: user.uid,
    driverId: driver.id,
    driverName: driver.name,

    requirementId,
    completionDate,
    completedAt: serverTimestamp(),

    completedByUserId: user.uid,
    completedByName:
      user.displayName ||
      user.email ||
      "Account owner",

    previousCompletionDate,
    nextDueDate,

    note: null,
    files: [],

    createdAt: serverTimestamp(),
  });

  await batch.commit();
};

  const archiveDriver = async (driver: Driver) => {
        const removeDriver = async () => {
          try {
            await updateDriver(driver.id, {
              status: "inactive",
              inactiveAt: serverTimestamp(),
            });

            setOpenDriverId(null);
          } catch (error) {
            console.error("Failed to remove driver:", error);

            if (Platform.OS === "web") {
              window.alert("The driver could not be removed. Please try again.");
            } else {
              Alert.alert(
                "Unable to remove driver",
                "The driver could not be removed. Please try again."
              );
            }
          }
        };

        const message =
          `${driver.name} will be removed from your active driver list. ` +
          "Their profile and compliance history will be preserved for future audits.";

        if (Platform.OS === "web") {
          const confirmed = window.confirm(
            `Remove driver from active list?\n\n${message}`
          );

          if (confirmed) {
            await removeDriver();
          }

          return;
        }

        Alert.alert(
          "Remove driver from active list?",
          message,
          [
            {
              text: "Cancel",
              style: "cancel",
            },
            {
              text: "Remove Driver",
              style: "destructive",
              onPress: removeDriver,
            },
          ]
        );
      };

  const addDriver = async () => {
    const user = auth.currentUser;
    if (!user || isAddingDriver) return;

    const driverName = newDriverName.trim();
    const normalizedCdlNumber = normalizeCdlNumber(newDriverNumber);
    const normalizedCdlClass = newDriverClass.trim().toUpperCase();
    const normalizedCdlState = newDriverState.trim().toUpperCase();

    if (!driverName) {
      Alert.alert("Driver name required", "Enter the driver's name.");
      return;
    }

    if (!normalizedCdlNumber) {
      Alert.alert(
        "CDL license number required",
        "Enter the driver's CDL license number."
      );
      return;
    }

    if (!["A", "B", "C"].includes(normalizedCdlClass)) {
      Alert.alert(
        "Valid CDL class required",
        "Enter CDL class A, B, or C."
      );
      return;
    }

    if (!/^[A-Z]{2}$/.test(normalizedCdlState)) {
      Alert.alert(
        "Valid CDL state required",
        "Enter the 2-letter issuing state abbreviation, such as WA."
      );
      return;
    }

    const clearForm = () => {
      setNewDriverName("");
      setNewDriverNumber("");
      setNewDriverClass("");
      setNewDriverState("");
    };

    const driversRef = collection(db, "carriers", user.uid, "drivers");

    setIsAddingDriver(true);

    try {
      // Keep the local normalized comparison for now so older driver records
      // with spaces/hyphens in stored CDL numbers are still detected.
      const snapshot = await getDocs(driversRef);

      const matchingDriverDoc = snapshot.docs.find((driverDoc) => {
        const driverData = driverDoc.data();

        return (
          normalizeCdlNumber(driverData.cdlNumber ?? "") ===
            normalizedCdlNumber &&
          String(driverData.cdlState ?? "").trim().toUpperCase() ===
            normalizedCdlState
        );
      });

      if (matchingDriverDoc) {
        const matchingDriver = matchingDriverDoc.data() as Driver;

        if (matchingDriver.status !== "inactive") {
          Alert.alert(
            "Driver already exists",
            `A driver with ${normalizedCdlState} CDL license number ${normalizedCdlNumber} is already on your active driver list.`
          );
          return;
        }

        const restoreDriver = async () => {
          setIsAddingDriver(true);

          try {
            await setDoc(
              doc(
                db,
                "carriers",
                user.uid,
                "drivers",
                matchingDriverDoc.id
              ),
              {
                name: driverName,
                cdlNumber: normalizedCdlNumber,
                cdlClass: normalizedCdlClass,
                cdlState: normalizedCdlState,
                status: "active",
                inactiveAt: null,
                rehiredAt: serverTimestamp(),
              },
              { merge: true }
            );

            clearForm();
            setOpenDriverId(matchingDriverDoc.id);
          } catch (error) {
            console.error("Failed to restore driver:", error);

            if (Platform.OS === "web") {
              window.alert(
                "The driver could not be restored. Please try again."
              );
            } else {
              Alert.alert(
                "Unable to restore driver",
                "The driver could not be restored. Please try again."
              );
            }
          } finally {
            setIsAddingDriver(false);
          }
        };

        const restoreMessage =
          `${matchingDriver.name || driverName} was previously removed from ` +
          "your active list. Their saved compliance history can be restored.";

        // The add operation is finished while the user decides whether to restore.
        setIsAddingDriver(false);

        if (Platform.OS === "web") {
          const confirmed = window.confirm(
            `Restore existing driver?\n\n${restoreMessage}`
          );

          if (confirmed) {
            await restoreDriver();
          }

          return;
        }

        Alert.alert(
          "Restore existing driver?",
          restoreMessage,
          [
            {
              text: "Cancel",
              style: "cancel",
            },
            {
              text: "Restore Driver",
              onPress: restoreDriver,
            },
          ]
        );

        return;
      }

      const id = Date.now().toString();

      await setDoc(doc(db, "carriers", user.uid, "drivers", id), {
        name: driverName,
        cdlNumber: normalizedCdlNumber,
        cdlClass: normalizedCdlClass,
        cdlState: normalizedCdlState,
        status: "active",
        inactiveAt: null,
        rehiredAt: null,
        cdlExpiration: "",
        medicalExpiration: "",
        mvrDue: "",
        clearinghouseDue: "",
        roadTestOnFile: false,
        employmentApplicationOnFile: false,
        initialMvrOnFile: false,
        speStatus: "missing",
        lcvStatus: "missing",
        previousEmployerInvestigationComplete: false,
      });

      clearForm();
    } catch (error) {
      console.error("Failed to add driver:", error);

      if (Platform.OS === "web") {
        window.alert("The driver could not be added. Please try again.");
      } else {
        Alert.alert(
          "Unable to add driver",
          "The driver could not be added. Please try again."
        );
      }
    } finally {
      setIsAddingDriver(false);
    }
  };

  return (
    <View
      style={{
        padding: 16,
        backgroundColor: "#F7F6F3",
        borderRadius: 14,
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: "600", marginBottom: 6 }}>
        Drivers
      </Text>

      {drivers.length === 0 ? (
        <Text style={{ color: "#706E68", marginBottom: 12 }}>
          No drivers yet.
        </Text>
      ) : (
        drivers.map((driver) => (
          <View
            key={driver.id}
            style={{
              padding: 12,
              backgroundColor: "#fff",
              borderRadius: 8,
              marginBottom: 8,
              borderWidth: 1,
              borderColor: "#E8E6E0",
            }}
          >
            <TouchableOpacity
              onPress={() =>
                setOpenDriverId(
                  openDriverId === driver.id ? null : driver.id
                )
              }
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontWeight: "600", fontSize: 16 }}>
                  {driver.name}
                </Text>

                <Text
                  style={{
                    fontSize: 18,
                    color: "#706E68",
                    fontWeight: "600",
                  }}
                >
                  {openDriverId === driver.id ? "⌃" : "⌄"}
                </Text>
                </View>

              <Text style={{ color: "#706E68", marginTop: 2 }}>
                {driver.cdlState} {"\u00B7"} License {driver.cdlNumber || "Not entered"}
              </Text>

              <Text style={{ color: "#8A8880", marginTop: 2, fontSize: 12 }}>
                CDL Class {driver.cdlClass || "\u2014"}
              </Text>
            </TouchableOpacity>

            {openDriverId === driver.id && (
              <View
                style={{
                  marginTop: 12,
                  paddingTop: 12,
                  borderTopWidth: 1,
                  borderTopColor: "#E8E6E0",
                }}
              >
                <Text style={{ fontWeight: "600", marginBottom: 10 }}>
                  Driver Compliance
                </Text>

                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: "#706E68",
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                    marginBottom: 10,
                  }}
                >
                  Ongoing driver compliance
                </Text>

                <DriverDateField
                  label="CDL Expiration"
                  value={driver.cdlExpiration}
                  onChange={(value: string) =>
                    updateDriver(driver.id, { cdlExpiration: value })
                  }
                />

                <DriverRenewalField
                  label="Medical Card - expiration date"
                  value={driver.medicalExpiration}
                  driverId={driver.id}
                  requirementId="medical"
                  dateRepresentsDueDate
                  onChange={(value: string) =>
                    updateDriver(driver.id, { medicalExpiration: value })
                  }
                  onMarkComplete={(
                  completionDate: string,
                  nextDueDate: string
                ) =>
                  markDriverRequirementComplete(
                    driver,
                    "medical",
                    "medicalExpiration",
                    completionDate,
                    nextDueDate
                  )
                }
                />

                <DriverRenewalField
                  label="Annual MVR - date of last review"
                  value={driver.mvrDue}
                  driverId={driver.id}
                  requirementId="mvr"
                  years={1}
                  onChange={(value: string) =>
                    updateDriver(driver.id, { mvrDue: value })
                  }
                  onMarkComplete={(
                    completionDate: string,
                    nextDueDate: string
                  ) =>
                    markDriverRequirementComplete(
                      driver,
                      "mvr",
                      "mvrDue",
                      completionDate,
                      nextDueDate
                    )
                  }
                />

                <DriverRenewalField
                  label="Clearinghouse - date of last annual query"
                  value={driver.clearinghouseDue}
                  driverId={driver.id}
                  requirementId="clearinghouse"
                  years={1}
                  onChange={(value: string) =>
                    updateDriver(driver.id, { clearinghouseDue: value })
                  }
                  onMarkComplete={(
                    completionDate: string,
                    nextDueDate: string
                  ) =>
                    markDriverRequirementComplete(
                      driver,
                      "clearinghouse",
                      "clearinghouseDue",
                      completionDate,
                      nextDueDate
                    )
                  }
                />

                <View
                  style={{
                    marginTop: 6,
                    marginBottom: 14,
                    borderWidth: 1,
                    borderColor: "#E2E0D8",
                    borderRadius: 10,
                    backgroundColor: "#FAFAF8",
                    overflow: "hidden",
                  }}
                >
                  <TouchableOpacity
                    onPress={() =>
                      setOpenDqDriverId(current =>
                        current === driver.id
                          ? null
                          : driver.id
                      )
                    }
                    activeOpacity={0.8}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingHorizontal: 12,
                      paddingVertical: 12,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "700",
                          color: "#1A1915",
                        }}
                      >
                        Driver Qualification File
                      </Text>

                      <Text
                        style={{
                          marginTop: 2,
                          fontSize: 11,
                          color: "#706E68",
                        }}
                      >
                        {getDqConfirmedCount(driver)} of 5 DQ checks resolved
                      </Text>
                    </View>

                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: "#27500A",
                      }}
                    >
                      {openDqDriverId === driver.id
                        ? "Hide"
                        : "Review ›"}
                    </Text>
                  </TouchableOpacity>

                  {openDqDriverId === driver.id && (
                    <View
                      style={{
                        paddingHorizontal: 12,
                        paddingBottom: 12,
                        borderTopWidth: 1,
                        borderTopColor: "#E8E6E0",
                      }}
                    >
                      <Text
                        style={{
                          marginTop: 10,
                          marginBottom: 8,
                          fontSize: 11,
                          fontWeight: "700",
                          color: "#706E68",
                          textTransform: "uppercase",
                          letterSpacing: 0.6,
                        }}
                      >
                        Initial setup
                      </Text>

                      <DriverStatusToggle
                        label="Employment application"
                        value={
                          driver.employmentApplicationOnFile ===
                          true
                        }
                        trueText="On file"
                        falseText="Missing"
                        onPress={() =>
                          updateDriver(driver.id, {
                            employmentApplicationOnFile:
                              !driver.employmentApplicationOnFile,
                          })
                        }
                      />

                      <DriverStatusToggle
                        label="Initial 3-year MVR(s)"
                        value={
                          driver.initialMvrOnFile === true
                        }
                        trueText="On file"
                        falseText="Missing"
                        onPress={() =>
                          updateDriver(driver.id, {
                            initialMvrOnFile:
                              !driver.initialMvrOnFile,
                          })
                        }
                      />

                      <DriverStatusToggle
                        label="Road test certificate / equivalent"
                        value={driver.roadTestOnFile === true}
                        trueText="On file"
                        falseText="Missing"
                        onPress={() =>
                          updateDriver(driver.id, {
                            roadTestOnFile:
                              !driver.roadTestOnFile,
                          })
                        }
                      />

                      <TouchableOpacity
                        onPress={() => {
                          const current =
                            driver.speStatus ?? "missing";

                          const next =
                            current === "missing"
                              ? "on_file"
                              : current === "on_file"
                                ? "not_applicable"
                                : "missing";

                          void updateDriver(driver.id, {
                            speStatus: next,
                          });
                        }}
                        activeOpacity={0.8}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          paddingVertical: 9,
                        }}
                      >
                        <Text
                          style={{
                            flex: 1,
                            paddingRight: 10,
                            fontSize: 12,
                            color: "#45433F",
                          }}
                        >
                          SPE / medical variance
                        </Text>

                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "600",
                            color:
                              driver.speStatus === "on_file"
                                ? "#3B6D11"
                                : driver.speStatus ===
                                    "not_applicable"
                                  ? "#706E68"
                                  : "#A32D2D",
                          }}
                        >
                          {driver.speStatus === "on_file"
                            ? "On file"
                            : driver.speStatus ===
                                "not_applicable"
                              ? "Not applicable"
                              : "Missing"}
                        </Text>
                      </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => {
                            const current =
                              driver.lcvStatus ?? "missing";

                            const next =
                              current === "missing"
                                ? "on_file"
                                : current === "on_file"
                                  ? "not_applicable"
                                  : "missing";

                            void updateDriver(driver.id, {
                              lcvStatus: next,
                            });
                          }}
                          activeOpacity={0.8}
                          style={{
                            width: "100%",
                            minHeight: 44,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            paddingVertical: 8,
                          }}
                        >
                          <Text
                            style={{
                              flex: 1,
                              paddingRight: 12,
                              fontSize: 12,
                              color: "#45433F",
                            }}
                          >
                            LCV training certificate
                          </Text>

                          <Text
                            numberOfLines={1}
                            style={{
                              flexShrink: 0,
                              fontSize: 11,
                              fontWeight: "600",
                              color:
                                driver.lcvStatus === "on_file"
                                  ? "#3B6D11"
                                  : driver.lcvStatus ===
                                      "not_applicable"
                                    ? "#706E68"
                                    : "#A32D2D",
                            }}
                          >
                            {driver.lcvStatus === "on_file"
                              ? "On file"
                              : driver.lcvStatus ===
                                  "not_applicable"
                                ? "Not applicable"
                                : "Missing"}
                          </Text>
                        </TouchableOpacity>

                      <View
                        style={{
                          marginTop: 8,
                          paddingTop: 10,
                          borderTopWidth: 1,
                          borderTopColor: "#E8E6E0",
                        }}
                      >
                        <Text
                          style={{
                            marginBottom: 8,
                            fontSize: 11,
                            fontWeight: "700",
                            color: "#706E68",
                            textTransform: "uppercase",
                            letterSpacing: 0.6,
                          }}
                        >
                          Hiring investigation
                        </Text>

                        <DriverStatusToggle
                          label="Previous-employer safety investigation"
                          value={
                            driver.previousEmployerInvestigationComplete ===
                            true
                          }
                          trueText="Complete"
                          falseText="Incomplete"
                          onPress={() =>
                            updateDriver(driver.id, {
                              previousEmployerInvestigationComplete:
                                !driver.previousEmployerInvestigationComplete,
                            })
                          }
                        />
                      </View>
                      <TouchableOpacity
  onPress={() =>
    setOpenDqHelpDriverId(current =>
      current === driver.id
        ? null
        : driver.id
    )
  }
  activeOpacity={0.8}
  style={{
    alignSelf: "flex-start",
    marginTop: 10,
    paddingVertical: 4,
  }}
>
  <Text
    style={{
      fontSize: 11,
      fontWeight: "600",
      color: "#27500A",
    }}
  >
    {openDqHelpDriverId === driver.id
      ? "Hide DQ guidance"
      : "What belongs in this file? ›"}
  </Text>
</TouchableOpacity>

{openDqHelpDriverId === driver.id && (
  <View
    style={{
      marginTop: 8,
      padding: 10,
      borderRadius: 8,
      backgroundColor: "#FFFFFF",
      borderWidth: 1,
      borderColor: "#E8E6E0",
    }}
  >
    <DqGuidanceItem
      title="Employment application"
      text="Keep the driver's completed employment application in the qualification file."
    />

    <DqGuidanceItem
      title="Initial 3-year MVR(s)"
      text="Obtain the driver's preceding 3-year driving record from each State where the driver was licensed."
    />

    <DqGuidanceItem
      title="Road test certificate / equivalent"
      text="Keep the road test certificate or an FMCSA-permitted equivalent qualification document."
    />

    <DqGuidanceItem
      title="SPE / medical variance"
      text="Required only when the driver operates under an applicable Skill Performance Evaluation certificate or medical variance."
    />

    <DqGuidanceItem
      title="LCV training certificate"
      text="Required only for drivers subject to FMCSA Longer Combination Vehicle training requirements."
      last
    />

    <View
  style={{
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E8E6E0",
  }}
>
  <Text
    style={{
      fontSize: 10,
      lineHeight: 15,
      color: "#706E68",
    }}
  >
    Medical expiration and annual MVR tracking
    remain under Ongoing Driver Compliance below.
  </Text>

  <Text
    style={{
      marginTop: 6,
      fontSize: 10,
      lineHeight: 15,
      color: "#706E68",
    }}
  >
    Previous-employer investigation records should
    be maintained separately with restricted access.
  </Text>
</View>
                    </View>
                    )}
                    </View>
                  )}
                </View>
              
                <View
                  style={{
                    marginTop: 16,
                    paddingTop: 16,
                    borderTopWidth: 1,
                    borderTopColor: "#E8E6E0",
                  }}
                >
                  <TouchableOpacity
                    onPress={() => archiveDriver(driver)}
                    style={{
                      alignSelf: "flex-start",
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      backgroundColor: "#FCEBEB",
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: "#E8B4B4",
                    }}
                  >
                    <Text
                      style={{
                        color: "#A32D2D",
                        fontWeight: "600",
                      }}
                    >
                      Remove Driver from Active List
                    </Text>
                  </TouchableOpacity>

                  <Text
                    style={{
                      maxWidth: 320,
                      marginTop: 7,
                      fontSize: 11,
                      lineHeight: 16,
                      color: "#706E68",
                    }}
                  >
                    Their driver profile and compliance history will be
                    preserved for future audits.
                  </Text>
                </View>
              </View>
            )}
          </View>
        ))
      )}

      <View style={{ marginTop: 12 }}>
        <DriverEntryField
          label="Driver name"
          placeholder="e.g., Sam Carter"
          value={newDriverName}
          onChangeText={setNewDriverName}
          width={280}
          autoCapitalize="words"
        />

        <DriverEntryField
          label="CDL License Number"
          placeholder="e.g., WDL123456"
          value={newDriverNumber}
          onChangeText={setNewDriverNumber}
          width={280}
          autoCapitalize="characters"
        />

        <DriverEntryField
          label="CDL Class"
          placeholder="A, B, or C"
          value={newDriverClass}
          onChangeText={setNewDriverClass}
          width={120}
          autoCapitalize="characters"
          maxLength={1}
        />

        <DriverEntryField
          label="Issuing State"
          placeholder="e.g., WA"
          value={newDriverState}
          onChangeText={setNewDriverState}
          width={120}
          autoCapitalize="characters"
          maxLength={2}
        />

        <TouchableOpacity
          accessibilityRole="button"
          disabled={isAddingDriver}
          onPress={addDriver}
          style={{
            alignSelf: "flex-start",
            paddingHorizontal: 12,
            paddingVertical: 8,
            backgroundColor: "#EAF3DE",
            borderRadius: 8,
            borderWidth: 1,
            borderColor: "#C0DD97",
            opacity: isAddingDriver ? 0.6 : 1,
          }}
        >
          <Text style={{ color: "#2B2A27" }}>
            {isAddingDriver ? "Adding Driver..." : "+ Add Driver"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function DriverDateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const status = dateStatus(value);

  return (
    <View style={{ marginBottom: 12 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 4,
          width: "100%",
        }}
      >
        <Text
          style={{
            fontSize: 12,
            color: "#706E68",
            flex: 1,
            paddingRight: 8,
          }}
        >
          {label}
        </Text>

        <View
          style={{
            backgroundColor: status.bg,
            borderRadius: 14,
            paddingHorizontal: 10,
            paddingVertical: 4,
            flexShrink: 0,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              color: status.color,
              fontWeight: "600",
            }}
          >
            {status.text}
          </Text>
        </View>
      </View>

      <PersistedDateInput
        value={value}
        onSave={onChange}
        accessibilityLabel={`${label} date`}
      />

      <Text style={{ fontSize: 11, color: "#8A8880", marginTop: 4 }}>
        Format: MM-DD-YYYY
      </Text>
    </View>
  );
}

function DqGuidanceItem({
  title,
  text,
  last = false,
}: {
  title: string;
  text: string;
  last?: boolean;
}) {
  return (
    <View
      style={{
        paddingBottom: last ? 0 : 9,
        marginBottom: last ? 0 : 9,
        borderBottomWidth:
          last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: "#E8E6E0",
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: "700",
          color: "#45433F",
        }}
      >
        {title}
      </Text>

      <Text
        style={{
          marginTop: 2,
          fontSize: 10,
          lineHeight: 15,
          color: "#706E68",
        }}
      >
        {text}
      </Text>
    </View>
  );
}

function DriverStatusToggle({
  label,
  value,
  trueText,
  falseText,
  onPress,
}: {
  label: string;
  value: boolean;
  trueText: string;
  falseText: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        width: "100%",
        minHeight: 44,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 8,
      }}
    >
      <Text
        style={{
          flex: 1,
          paddingRight: 12,
          fontSize: 12,
          lineHeight: 17,
          color: "#45433F",
        }}
      >
        {label}
      </Text>

      <View
        style={{
          flexShrink: 0,
          borderRadius: 12,
          paddingHorizontal: 10,
          paddingVertical: 5,
          backgroundColor: value
            ? "#EAF3DE"
            : "#FCEBEB",
          borderWidth: 1,
          borderColor: value
            ? "#C0DD97"
            : "#F2B8B5",
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            fontSize: 11,
            fontWeight: "600",
            color: value
              ? "#3B6D11"
              : "#A32D2D",
          }}
        >
          {value ? trueText : falseText}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function dateStatus(date: string) {
  if (!date) {
    return {
      text: "Needs date",
      color: "#A32D2D",
      bg: "#FCEBEB",
    };
  }

  const days = daysFrom(date);

  if (days === null) {
    return {
      text: "Needs date",
      color: "#A32D2D",
      bg: "#FCEBEB",
    };
  }

  if (days < 0) {
    return {
      text: `${Math.abs(days)} overdue`,
      color: "#A32D2D",
      bg: "#FCEBEB",
    };
  }

  if (days <= 30) {
    return {
      text: `${days} days`,
      color: "#854F0B",
      bg: "#FAEEDA",
    };
  }

  if (days <= 90) {
    return {
      text: `${days} days`,
      color: "#185FA5",
      bg: "#E6F1FB",
    };
  }

  return {
    text: `${days} days`,
    color: "#3B6D11",
    bg: "#EAF3DE",
  };
}
