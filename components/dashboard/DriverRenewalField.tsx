import { useState } from "react";
import {
  Alert,
  Platform,
  View,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";
import {
  formatDateInput,
  inputToIso,
  isoToInput,
} from "../../lib/dateUtils";
import PersistedDateInput from "./PersistedDateInput";
import { useComplianceHistory } from "../../store/useComplianceHistory";
import {
  addDays,
  addYears,
  daysFrom,
  localDateString,
} from "../../lib/requirements";
type Props = {
  dateRepresentsDueDate?: boolean;
  label: string;
  value: string;
  driverId: string;
  requirementId: "medical" | "mvr" | "clearinghouse";
  years?: number;
  days?: number;
  onChange: (value: string) => void;
  onMarkComplete?: (
    completionDate: string,
    nextDueDate: string
  ) => void;
};


function addInterval(dateStr: string, years = 0, days = 0) {
  if (!dateStr) return "";

  if (years) {
    return addYears(dateStr, years);
  }

  if (days) {
    return addDays(dateStr, days);
  }

  return dateStr;
}


function getBadge(daysLeft: number | null) {
  if (daysLeft === null) {
    return {
      text: "Needs date",
      bg: "#FCEBEB",
      color: "#A32D2D",
    };
  }

  if (daysLeft < 0) {
    return {
      text: `${Math.abs(daysLeft)} overdue`,
      bg: "#FCEBEB",
      color: "#A32D2D",
    };
  }

  if (daysLeft <= 30) {
    return {
      text: `${daysLeft} days`,
      bg: "#FAEEDA",
      color: "#854F0B",
    };
  }

  if (daysLeft <= 90) {
    return {
      text: `${daysLeft} days`,
      bg: "#E6F1FB",
      color: "#185FA5",
    };
  }

  return {
    text: `${daysLeft} days`,
    bg: "#EAF3DE",
    color: "#3B6D11",
  };
}

   

export default function DriverRenewalField({
  label,
  value,
  driverId,
  requirementId,
  years = 0,
  days = 0,
  onChange,
  onMarkComplete,
  dateRepresentsDueDate = false,
}: Props) { 
  const isValidDateFormat = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const nextDue = isValidDateFormat
  ? dateRepresentsDueDate
    ? value
    : addInterval(value, years, days)
  : "";
  const daysLeft = nextDue ? daysFrom(nextDue) : null;
  const badge = getBadge(daysLeft);
  const today = localDateString();
  const [confirming, setConfirming] = useState(false);

const [completionDate, setCompletionDate] = useState(
  isoToInput(today)
);
const [replacementDueDate, setReplacementDueDate] = useState("");

const [historyOpen, setHistoryOpen] = useState(false);

const [deletingRecordId, setDeletingRecordId] =
  useState<string | null>(null);

const {
  records: historyRecords,
  loading: historyLoading,
  error: historyError,
  deleteRecord,
} = useComplianceHistory(
  requirementId,
  driverId
);

  async function handleHistoryRecordMenu(
  recordId: string,
  displayDate: string
) {
  if (Platform.OS === "web") {
    const confirmed = window.confirm(
      `Delete the completion record dated ${displayDate}? This cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingRecordId(recordId);
      await deleteRecord(recordId);
    } catch (error) {
      console.log(
        "Delete driver compliance record failed:",
        error
      );

      window.alert(
        "Could not delete the compliance record. Please try again."
      );
    } finally {
      setDeletingRecordId(null);
    }

    return;
  }

  Alert.alert(
    "Compliance record",
    displayDate,
    [
      {
        text: "Delete record",
        style: "destructive",
        onPress: async () => {
          try {
            setDeletingRecordId(recordId);
            await deleteRecord(recordId);
          } catch (error) {
            console.log(
              "Delete driver compliance record failed:",
              error
            );

            Alert.alert(
              "Could not delete record",
              "Please try again."
            );
          } finally {
            setDeletingRecordId(null);
          }
        },
      },
      {
        text: "Cancel",
        style: "cancel",
      },
    ]
  );
}

  return (
          <View style={{ marginBottom: 14 }}>
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
                backgroundColor: badge.bg,
                borderRadius: 14,
                paddingHorizontal: 10,
                paddingVertical: 4,
                flexShrink: 0,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  color: badge.color,
                }}
              >
                {badge.text}
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
            {nextDue ? (
              <>
                {" \u00B7 "}Next due: {isoToInput(nextDue)}
              </>
            ) : null}
          </Text>
      {nextDue && onMarkComplete ? (
  <TouchableOpacity
  onPress={() => {
      setCompletionDate(
      isoToInput(today)
    );
  setReplacementDueDate("");
  setConfirming(true);
    }}
    style={{
      alignSelf: "flex-start",
      marginTop: 8,
      backgroundColor: "#EAF3DE",
      borderRadius: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: "#C0DD97",
    }}
  >
    <Text style={{ fontSize: 12, color: "#27500A", fontWeight: "600" }}>
      Mark complete
    </Text>
  </TouchableOpacity>
) : null}
{confirming ? (
  <View style={{ marginTop: 8 }}>
    <Text style={{ fontSize: 12, color: "#706E68", marginBottom: 4 }}>
      Completion date
    </Text>

    <TextInput
      placeholder="MM-DD-YYYY"
      value={completionDate}
      onChangeText={(text) => setCompletionDate(formatDateInput(text))}
      style={{
        width: 160,
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#D3D1C7",
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
      }}
    />

    {dateRepresentsDueDate ? (
      <>
        <Text style={{ fontSize: 12, color: "#706E68", marginTop: 10, marginBottom: 4 }}>
          New expiration date
        </Text>
        <TextInput
          placeholder="MM-DD-YYYY"
          value={replacementDueDate}
          onChangeText={(text) => setReplacementDueDate(formatDateInput(text))}
          style={{
            width: 160,
            backgroundColor: "#fff",
            borderWidth: 1,
            borderColor: "#D3D1C7",
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 8,
          }}
        />
        <Text style={{ fontSize: 11, color: "#8A8880", marginTop: 4 }}>
          Enter the expiration shown on the new medical certification.
        </Text>
      </>
    ) : null}

    <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
      <TouchableOpacity
        onPress={() => setConfirming(false)}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: "#D3D1C7",
          backgroundColor: "#fff",
        }}
      >
        <Text style={{ fontSize: 12, color: "#706E68" }}>Cancel</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => {
          if (!completionDate || !onMarkComplete) {
            return;
          }

          const isoCompletionDate =
            inputToIso(completionDate);

          if (!isoCompletionDate) {
            return;
          }

          const confirmedNextDue =
            dateRepresentsDueDate
              ? inputToIso(replacementDueDate)
              : addInterval(
                  isoCompletionDate,
                  years,
                  days
                );

          if (!confirmedNextDue) {
            return;
          }

          onMarkComplete(
          isoCompletionDate,
          confirmedNextDue
        );

        setConfirming(false);
        }}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: "#C0DD97",
          backgroundColor: "#EAF3DE",
        }}
      >
        <Text style={{ fontSize: 11, color: "#27500A", fontWeight: "600" }}>
          Confirm
        </Text>
      </TouchableOpacity>
    </View>
  </View>
) : null}
<TouchableOpacity
  onPress={() =>
    setHistoryOpen(
      current => !current
    )
  }
  activeOpacity={0.8}
  style={{
    alignSelf: "flex-start",
    marginTop: 10,
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
      fontSize: 12,
      fontWeight: "700",
      color: "#27500A",
    }}
  >
    {historyOpen
      ? "Hide compliance record"
      : `Compliance record${
          historyRecords.length > 0
            ? ` (${historyRecords.length})`
            : ""
        }`}
  </Text>
</TouchableOpacity>

{historyOpen && (
  <View
    style={{
      marginTop: 10,
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "#E2E0D8",
      backgroundColor: "#FAFAF8",
    }}
  >
    <Text
      style={{
        fontSize: 14,
        fontWeight: "700",
        color: "#1A1915",
        marginBottom: 10,
      }}
    >
      Compliance record
    </Text>

    {historyLoading && (
      <Text
        style={{
          fontSize: 12,
          color: "#706E68",
        }}
      >
        Loading records...
      </Text>
    )}

    {!historyLoading &&
      historyError && (
        <Text
          style={{
            fontSize: 12,
            color: "#A32D2D",
          }}
        >
          Could not load the compliance record.
        </Text>
      )}

    {!historyLoading &&
      !historyError &&
      historyRecords.length === 0 && (
        <Text
          style={{
            fontSize: 12,
            color: "#706E68",
          }}
        >
          No completion records yet.
        </Text>
      )}

    {!historyLoading &&
      !historyError &&
      historyRecords.map(
        (record, index) => {
          const displayDate =
            record.completionDate
              ? isoToInput(
                  record.completionDate
                )
              : record.completedAt
                ? record.completedAt.toLocaleDateString(
                    "en-US"
                  )
                : "Completion date unavailable";

          return (
            <View
              key={record.id}
              style={{
                paddingTop:
                  index === 0 ? 0 : 10,
                paddingBottom: 10,
                borderTopWidth:
                  index === 0 ? 0 : 1,
                borderTopColor:
                  "#E2E0D8",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent:
                    "space-between",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: "#1A1915",
                    flex: 1,
                  }}
                >
                  {displayDate}
                </Text>

                <TouchableOpacity
                  onPress={() =>
                    handleHistoryRecordMenu(
                      record.id,
                      displayDate
                    )
                  }
                  disabled={
                    deletingRecordId ===
                    record.id
                  }
                  activeOpacity={0.7}
                  style={{
                    width: 32,
                    height: 32,
                    marginLeft: 8,
                    borderRadius: 16,
                    alignItems: "center",
                    justifyContent:
                      "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 22,
                      lineHeight: 24,
                      color: "#706E68",
                      opacity:
                        deletingRecordId ===
                        record.id
                          ? 0.4
                          : 1,
                    }}
                  >
                    ⋮
                  </Text>
                </TouchableOpacity>
              </View>

              <Text
                style={{
                  marginTop: 3,
                  fontSize: 12,
                  color: "#706E68",
                }}
              >
                Completed by{" "}
                {record.completedByName}
              </Text>

              {record.nextDueDate && (
                <Text
                  style={{
                    marginTop: 3,
                    fontSize: 12,
                    color: "#706E68",
                  }}
                >
                  Next due:{" "}
                  {isoToInput(
                    record.nextDueDate
                  )}
                </Text>
              )}

              {record.note && (
                <Text
                  style={{
                    marginTop: 5,
                    fontSize: 12,
                    color: "#45433F",
                  }}
                >
                  {record.note}
                </Text>
              )}

              {record.files &&
                Array.isArray(
                  record.files
                ) &&
                record.files.length > 0 && (
                  <Text
                    style={{
                      marginTop: 5,
                      fontSize: 12,
                      color: "#185FA5",
                      fontWeight: "600",
                    }}
                  >
                    Attachments:{" "}
                    {record.files.length}
                  </Text>
                )}
            </View>
          );
        }
      )}
  </View>
)}
    </View>
    
  );
  
}
