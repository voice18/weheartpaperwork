import { useState } from "react";
import {
  useComplianceHistory,
} from "../../store/useComplianceHistory";
import {
  Alert,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import {
  calcUsdotDue,
  calculateNextDue,
  daysFrom,
  fmtDate,
  localDateString,
  urgency,
} from "../../lib/requirements";
import {
  formatDateInput,
  inputToIso,
  isoToInput,
} from "../../lib/dateUtils";

type RequirementRowProps = {
  r: any;
  onSave: (
    requirementId: string,
    enteredDate: string,
    dueDate: string
  ) => void;
  onComplete: (
    requirementId: string,
    completionDate: string
  ) => void;
  onUndo: (
    requirementId: string
  ) => void;
  onSetUsdot: (
    usdotNumber: string
  ) => void;
  onSetApplicable: (
    requirementId: string,
    applicable: boolean
  ) => void;
};

export default function RequirementRow({
  r,
  onSave,
  onComplete,
  onUndo,
  onSetUsdot,
  onSetApplicable,
}: RequirementRowProps) {
  const [open, setOpen] =
    useState(false);
const [
  historyOpen,
  setHistoryOpen,
] = useState(false);
const [
  deletingRecordId,
  setDeletingRecordId,
] = useState<string | null>(null);

const {
  records: historyRecords,
  loading: historyLoading,
  error: historyError,
  deleteRecord,
} = useComplianceHistory(
  String(r.id)
);

const fixedCalendarIds = [
  "tax2290",
  "ucr",
  "ifta",
];

const latestHistoryRecord =
  historyRecords[0] ?? null;

const currentYear =
  new Date().getFullYear();

const previousDueYear =
  latestHistoryRecord?.previousDueDate
    ? Number(
        latestHistoryRecord.previousDueDate.slice(
          0,
          4
        )
      )
    : null;

const canUndoFixedCalendarCompletion =
  fixedCalendarIds.includes(
    String(r.id)
  ) &&
  !r.completed &&
  latestHistoryRecord?.nextDueDate ===
    r.due &&
  previousDueYear === currentYear;

  const [
    confirmingComplete,
    setConfirmingComplete,
  ] = useState(false);

  const [
  completionDate,
  setCompletionDate,
] = useState(() =>
  isoToInput(localDateString())
);

  const [
  enteredDate,
  setEnteredDate,
] = useState(
  isoToInput(r.enteredDate || "")
);

  const [
    usdotInput,
    setUsdotInput,
  ] = useState("");

  const isApplicable =
    r.applicable !== false;

  const urg = urgency(r);

  const badgeColor =
    urg === "od"
      ? "#A32D2D"
      : urg === "sn"
        ? "#854F0B"
        : urg === "up"
          ? "#185FA5"
          : "#3B6D11";

  const badgeBg =
    urg === "od"
      ? "#FCEBEB"
      : urg === "sn"
        ? "#FAEEDA"
        : urg === "up"
          ? "#E6F1FB"
          : "#EAF3DE";

  const rawDays =
    daysFrom(r.due);

  const days =
    rawDays === null
      ? null
      : rawDays < 0
        ? Math.abs(rawDays)
        : rawDays;

  const badgeText =
    urg === "done"
      ? "✓ Done"
      : !r.due || days === null
        ? "Needs Date"
        : rawDays === 0
          ? "Due Today"
          : urg === "od"
            ? `${days} overdue`
            : `${days} days`;

  const isBoc3Unfiled =
    r.id === "boc3" &&
    !r.completed;

  const finalBadgeColor =
    !isApplicable
      ? "#706E68"
      : isBoc3Unfiled
        ? "#A32D2D"
        : badgeColor;

  const finalBadgeBg =
    !isApplicable
      ? "#E8E8E5"
      : isBoc3Unfiled
        ? "#FCEBEB"
        : badgeBg;

  const finalBadgeText =
    !isApplicable
      ? "Does not apply"
      : isBoc3Unfiled
        ? "Unfiled"
        : badgeText;

  function handleMarkNotApplicable() {
  const message =
    `${r.n} will remain visible, but it will no longer count down ` +
    `or send notifications. You can turn it back on at any time.`;

  if (Platform.OS === "web") {
    const confirmed = window.confirm(
      `Mark as not applicable?\n\n${message}`
    );

    if (confirmed) {
      onSetApplicable(r.id, false);
    }

    return;
  }

  Alert.alert(
    "Mark as not applicable?",
    message,
    [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Does not apply",
        style: "destructive",
        onPress: () =>
          onSetApplicable(r.id, false),
      },
    ]
  );
}

  function handleSaveDate() {
  const isoDate = inputToIso(enteredDate);

  if (!isoDate) {
    return;
  }

  const nextDue =
    calculateNextDue(
      r.id,
      isoDate
    );

  if (!nextDue) {
    return;
  }

  onSave(
    r.id,
    isoDate,
    nextDue
  );
}

function handleDeleteHistoryRecord(
  recordId: string,
  displayDate: string
) {
  Alert.alert(
    "Delete compliance record?",
    `Delete the completion record dated ${displayDate}? This cannot be undone.`,
    [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            setDeletingRecordId(
              recordId
            );

            await deleteRecord(
              recordId
            );
          } catch (error) {
            console.log(
              "Delete compliance record failed:",
              error
            );

            Alert.alert(
              "Could not delete record",
              "Please try again."
            );
          } finally {
            setDeletingRecordId(
              null
            );
          }
        },
      },
    ]
  );
}

async function handleUndoFixedCalendarCompletion() {
  if (!latestHistoryRecord) {
    return;
  }

  const undo = async () => {
    try {
      setDeletingRecordId(
        latestHistoryRecord.id
      );

      await deleteRecord(
        latestHistoryRecord.id
      );
    } catch (error) {
      console.log(
        "Undo fixed-calendar completion failed:",
        error
      );

      if (Platform.OS === "web") {
        window.alert(
          "The completion could not be undone. Please try again."
        );
      } else {
        Alert.alert(
          "Unable to undo completion",
          "Please try again."
        );
      }
    } finally {
      setDeletingRecordId(null);
    }
  };

  if (Platform.OS === "web") {
    const confirmed = window.confirm(
      "Undo last completion?\n\n" +
        "This will restore the previous due date and remove the latest completion record."
    );

    if (confirmed) {
      await undo();
    }

    return;
  }

  Alert.alert(
    "Undo last completion?",
    "This will restore the previous due date and remove the latest completion record.",
    [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Undo completion",
        onPress: () => {
          void undo();
        },
      },
    ]
  );
}

  function handleConfirmCompletion() {
  const isoDate = inputToIso(completionDate);

  if (!isoDate) {
    return;
  }

  onComplete(
    r.id,
    isoDate
  );

  setConfirmingComplete(false);
}
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
        "Delete compliance record failed:",
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
        onPress: () => {
          Alert.alert(
            "Delete compliance record?",
            `Delete the completion record dated ${displayDate}? This cannot be undone.`,
            [
              {
                text: "Cancel",
                style: "cancel",
              },
              {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                  try {
                    setDeletingRecordId(recordId);
                    await deleteRecord(recordId);
                  } catch (error) {
                    console.log(
                      "Delete compliance record failed:",
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
            ]
          );
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
    <View
      style={{
        backgroundColor:
          isApplicable
            ? "#FFFFFF"
            : "#F1F1EF",
        borderWidth: 1,
        borderColor:
          open
            ? "#C9D9B8"
            : "#E2E0D8",
        borderRadius: 12,
        marginBottom: 10,
        overflow: "hidden",
      }}
    >
      <TouchableOpacity
        onPress={() =>
          setOpen(
            current =>
              !current
          )
        }
        activeOpacity={0.8}
        style={{
          paddingHorizontal: 14,
          paddingVertical: 13,
          backgroundColor:
            !isApplicable
              ? "#F1F1EF"
              : open
                ? "#F8FAF5"
                : "#FFFFFF",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent:
              "space-between",
          }}
        >
          <View
            style={{
              flex: 1,
              paddingRight: 10,
            }}
          >
            <Text
              style={{
                fontSize: 15,
                fontWeight: "700",
                color:
                  isApplicable
                    ? "#1A1915"
                    : "#77756F",
                lineHeight: 20,
              }}
            >
              {r.n}
            </Text>

            <Text
              style={{
                fontSize: 12,
                color: "#706E68",
                marginTop: 3,
              }}
            >
              {r.f}
            </Text>

            {isApplicable &&
            r.due ? (
              <Text
                style={{
                  fontSize: 12,
                  color: "#706E68",
                  marginTop: 2,
                }}
              >
                Next due:{" "}
                {fmtDate(
                  r.due
                )}
              </Text>
            ) : null}
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 14,
                backgroundColor:
                  finalBadgeBg,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color:
                    finalBadgeColor,
                }}
              >
                {finalBadgeText}
              </Text>
            </View>

            <Text
              style={{
                fontSize: 16,
                color: "#706E68",
                fontWeight: "600",
              }}
            >
              {open
                ? "⌃"
                : "⌄"}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {open && (
        <View
          style={{
            paddingHorizontal: 12,
            paddingBottom: 14,
            borderTopWidth: 0.5,
            borderColor: "#F0EDE6",
          }}
        >
          <Text
            style={{
              fontSize: 12,
              color: "#706E68",
              lineHeight: 18,
              paddingVertical: 8,
            }}
          >
            {r.notes}
          </Text>

          {!isApplicable && (
            <View
              style={{
                marginTop: 4,
                marginBottom: 6,
                padding: 12,
                backgroundColor:
                  "#ECECE9",
                borderRadius: 10,
                borderWidth: 1,
                borderColor:
                  "#D5D4CF",
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: "#55534E",
                }}
              >
                This requirement is
                not active
              </Text>

              <Text
                style={{
                  fontSize: 12,
                  lineHeight: 18,
                  color: "#706E68",
                  marginTop: 4,
                }}
              >
                It will not appear in
                countdowns, attention
                totals, or
                notifications. Your
                saved information has
                been kept.
              </Text>

              <TouchableOpacity
                onPress={() =>
                  onSetApplicable(
                    r.id,
                    true
                  )
                }
                activeOpacity={0.8}
                style={{
                  alignSelf:
                    "flex-start",
                  marginTop: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor:
                    "#BFC9B5",
                  backgroundColor:
                    "#FFFFFF",
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: "#3B6D11",
                  }}
                >
                  Make requirement
                  active
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {isApplicable && (
            <>
              <View
                style={{
                  flexDirection:
                    "row",
                  justifyContent:
                    "space-between",
                  paddingVertical: 5,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    color: "#706E68",
                  }}
                >
                  Next due
                </Text>

                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "500",
                    color: "#1A1915",
                  }}
                >
                  {fmtDate(r.due)}
                </Text>
              </View>

              {r.id ===
                "mcs150" && (
                <View
                  style={{
                    marginTop: 8,
                    marginBottom: 8,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color: "#706E68",
                      marginBottom: 4,
                    }}
                  >
                    USDOT number
                  </Text>

                  <TextInput
                    placeholder="Enter USDOT number"
                    value={
                      usdotInput
                    }
                    onChangeText={
                      setUsdotInput
                    }
                    keyboardType="numeric"
                    style={{
                      width: 180,
                      backgroundColor:
                        "#FFFFFF",
                      borderWidth: 1,
                      borderColor:
                        "#D3D1C7",
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                    }}
                  />

                  {usdotInput ? (
                    <Text
                      style={{
                        fontSize: 12,
                        color: "#706E68",
                        marginTop: 6,
                      }}
                    >
                      MCS-150 filing
                      date from USDOT:{" "}
                      {fmtDate(
                        calcUsdotDue(
                          usdotInput
                        )
                      )}
                    </Text>
                  ) : null}

                  <TouchableOpacity
                    onPress={() => {
                      if (
                        !usdotInput
                      ) {
                        return;
                      }

                      onSetUsdot(
                        usdotInput
                      );
                    }}
                    activeOpacity={0.8}
                    style={{
                      alignSelf:
                        "flex-start",
                      marginTop: 8,
                      backgroundColor:
                        "#EAF3DE",
                      borderRadius: 6,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderWidth: 1,
                      borderColor:
                        "#C0DD97",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        color: "#27500A",
                        fontWeight: "600",
                      }}
                    >
                      Save USDOT number
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {r.dateMode !==
                "fixed-calendar" &&
                r.dateMode !==
                  "none" &&
                (r.de === true ||
                  r.de ===
                    "usdot") &&
                !String(
                  r.id
                ).startsWith(
                  "driver-"
                ) && (
                  <View
                    style={{
                      marginTop: 8,
                      marginBottom: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        color: "#706E68",
                        marginBottom: 4,
                      }}
                    >
                      {r.dateMode ===
                      "fixed-user-date"
                        ? r.dl ||
                          "Next due date"
                        : r.dl ||
                          "Date of last completion"}
                    </Text>

                    <TextInput
                      placeholder="MM-DD-YYYY"
                      value={
                        enteredDate
                      }
                      onChangeText={text =>
                        setEnteredDate(
                          formatDateInput(
                            text
                          )
                        )
                      }
                      style={{
                        width: 160,
                        backgroundColor:
                          "#FFFFFF",
                        borderWidth: 1,
                        borderColor:
                          "#D3D1C7",
                        borderRadius: 8,
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                      }}
                    />

                    <Text
                      style={{
                        fontSize: 11,
                        color: "#8A8880",
                        marginTop: 4,
                      }}
                    >
                      Format:
                      MM-DD-YYYY
                    </Text>

                    <TouchableOpacity
                      onPress={
                        handleSaveDate
                      }
                      activeOpacity={0.8}
                      style={{
                        alignSelf:
                          "flex-start",
                        marginTop: 8,
                        backgroundColor:
                          "#EAF3DE",
                        borderRadius: 6,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderWidth: 1,
                        borderColor:
                          "#C0DD97",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          color: "#27500A",
                          fontWeight:
                            "500",
                        }}
                      >
                        Save date
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

              <View
                style={{
                  backgroundColor:
                    "#FCEBEB",
                  borderRadius: 6,
                  padding: 10,
                  marginVertical: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    color: "#791F1F",
                    lineHeight: 17,
                  }}
                >
                  If missed:{" "}
                  {r.cons}
                </Text>
              </View>

              {confirmingComplete && (
                <View
                  style={{
                    marginTop: 12,
                    padding: 12,
                    backgroundColor:
                      "#F8FAF5",
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor:
                      "#D6E4C9",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: "#1A1915",
                      marginBottom: 4,
                    }}
                  >
                    Confirm completion
                  </Text>

                  <Text
                    style={{
                      fontSize: 12,
                      color: "#706E68",
                      marginBottom: 8,
                    }}
                  >
                    Enter the date this
                    requirement was
                    completed.
                  </Text>

                  <TextInput
                    placeholder="MM-DD-YYYY"
                    value={
                      completionDate
                    }
                    onChangeText={text =>
                      setCompletionDate(
                        formatDateInput(
                          text
                        )
                      )
                    }
                    style={{
                      width: 160,
                      backgroundColor:
                        "#FFFFFF",
                      borderWidth: 1,
                      borderColor:
                        "#D3D1C7",
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                    }}
                  />

                  <View
                    style={{
                      flexDirection:
                        "row",
                      gap: 8,
                      marginTop: 10,
                    }}
                  >
                    <TouchableOpacity
                      onPress={() =>
                        setConfirmingComplete(
                          false
                        )
                      }
                      activeOpacity={0.8}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor:
                          "#D3D1C7",
                        backgroundColor:
                          "#FFFFFF",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          color:
                            "#706E68",
                          fontWeight:
                            "600",
                        }}
                      >
                        Cancel
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={
                        handleConfirmCompletion
                      }
                      activeOpacity={0.8}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor:
                          "#9FC36A",
                        backgroundColor:
                          "#DDEFC5",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          color:
                            "#27500A",
                          fontWeight:
                            "700",
                        }}
                      >
                        Confirm
                        completion
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {!r.completed &&
                !confirmingComplete &&
                !String(
                  r.id
                ).startsWith(
                  "driver-"
                ) && (
                  <View
                    style={{
                      marginTop: 10,
                      alignItems: "flex-start",
                    }}
                  >
                    {canUndoFixedCalendarCompletion && (
                      <TouchableOpacity
                        onPress={handleUndoFixedCalendarCompletion}
                        activeOpacity={0.8}
                        style={{
                          marginBottom: 8,
                          paddingVertical: 6,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            color: "#3B6D11",
                            textDecorationLine: "underline",
                            fontWeight: "600",
                          }}
                        >
                          Undo last completion
                        </Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      onPress={() => {
                        setCompletionDate(
                          isoToInput(localDateString())
                        );
                        setConfirmingComplete(true);
                      }}
                      activeOpacity={0.8}
                      style={{
                        alignSelf: "flex-start",
                        paddingHorizontal: 14,
                        paddingVertical: 9,
                        backgroundColor: "#EAF3DE",
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: "#C0DD97",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "700",
                          color: "#27500A",
                        }}
                      >
                        Mark complete
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              {r.completed && (
                <View
                  style={{
                    marginTop: 12,
                    padding: 12,
                    backgroundColor:
                      "#F1F7EA",
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor:
                      "#C0DD97",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: "#27500A",
                    }}
                  >
                    ✓ Completed
                  </Text>

                  <Text
                    style={{
                      marginTop: 3,
                      fontSize: 12,
                      color: "#557238",
                    }}
                  >
                    This requirement
                    has been marked
                    complete.
                  </Text>

                  <TouchableOpacity
                    onPress={() =>
                      onUndo(r.id)
                    }
                    activeOpacity={0.8}
                    style={{
                      alignSelf:
                        "flex-start",
                      marginTop: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        color: "#3B6D11",
                        textDecorationLine:
                          "underline",
                      }}
                    >
                      Undo completion
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
  onPress={() =>
    setHistoryOpen(
      current => !current
    )
  }
  activeOpacity={0.8}
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
          Could not load the
          compliance record.
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
              ? fmtDate(
                  record.completionDate
                )
              : record.completedAt
                ? record.completedAt.toLocaleDateString(
                    "en-US",
                    {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    }
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
            justifyContent: "space-between",
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
              deletingRecordId === record.id
            }
            activeOpacity={0.7}
            style={{
              width: 32,
              height: 32,
              marginLeft: 8,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontSize: 22,
                lineHeight: 24,
                color: "#706E68",
                opacity:
                  deletingRecordId === record.id
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

              {record.file?.name && (
                <Text
                  style={{
                    marginTop: 5,
                    fontSize: 12,
                    color: "#185FA5",
                    fontWeight: "600",
                  }}
                >
                  Attached:{" "}
                  {record.file.name}
                </Text>
              )}
              
            </View>
          );
        }
      )}
  </View>
)}

              {r.canBeNotApplicable &&
                !String(
                  r.id
                ).startsWith(
                  "driver-"
                ) && (
                  <TouchableOpacity
                    onPress={
                      handleMarkNotApplicable
                    }
                    activeOpacity={0.8}
                    style={{
                      alignSelf:
                        "flex-start",
                      marginTop: 14,
                      paddingVertical: 6,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        color: "#706E68",
                        textDecorationLine:
                          "underline",
                      }}
                    >
                      This requirement
                      does not apply to
                      my company
                    </Text>
                  </TouchableOpacity>
                )}
            </>
          )}
        </View>
      )}
    </View>
  );
}