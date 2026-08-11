import { useEffect, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore";

import { auth, db } from "../lib/firebase";

export type ComplianceHistoryRecord = {
  id: string;
  requirementId: string;
  completionDate: string | null;
  completedByName: string;
  completedByUserId: string | null;
  completedAt: Date | null;
  createdAt: Date | null;
  previousDueDate: string | null;
  previousEnteredDate: string | null;
  previousCompletionDate: string | null;
  nextDueDate: string | null;
  note: string | null;
  file: {
    name?: string;
    downloadUrl?: string;
    storagePath?: string;
  } | null;
  files?: Array<{
  id?: string;
  name?: string;
  downloadUrl?: string;
  storagePath?: string;
}>;

};

export function useComplianceHistory(
  requirementId: string,
  driverId?: string
) {
  const [records, setRecords] = useState<
    ComplianceHistoryRecord[]
  >([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);



  useEffect(() => {
    const carrierId =
      auth.currentUser?.uid;

    if (!carrierId || !requirementId) {
      setRecords([]);
      return;
    }

    setLoading(true);
    setError(null);

    const historyRef = driverId
  ? collection(
      db,
      "carriers",
      carrierId,
      "drivers",
      driverId,
      "complianceRecords",
      requirementId,
      "history"
    )
  : collection(
      db,
      "carriers",
      carrierId,
      "complianceRecords",
      requirementId,
      "history"
    );

    const unsubscribe = onSnapshot(
      historyRef,
      snapshot => {
        const nextRecords =
          snapshot.docs.map(document => {
            const data = document.data();

            return {
              id: document.id,

              requirementId:
                data.requirementId ||
                requirementId,

              completionDate:
                typeof data.completionDate ===
                "string"
                  ? data.completionDate
                  : null,

              completedByName:
                typeof data.completedByName ===
                "string"
                  ? data.completedByName
                  : "Account owner",

              completedByUserId:
                typeof data.completedByUserId ===
                "string"
                  ? data.completedByUserId
                  : null,

              completedAt:
                data.completedAt instanceof
                Timestamp
                  ? data.completedAt.toDate()
                  : null,

              createdAt:
                data.createdAt instanceof
                Timestamp
                  ? data.createdAt.toDate()
                  : null,

              previousDueDate:
                typeof data.previousDueDate ===
                "string"
                  ? data.previousDueDate
                  : null,

              previousEnteredDate:
                typeof data.previousEnteredDate === "string"
                  ? data.previousEnteredDate
                  : null,

              previousCompletionDate:
                typeof data.previousCompletionDate === "string"
                  ? data.previousCompletionDate
                  : null,

              nextDueDate:
                typeof data.nextDueDate ===
                "string"
                  ? data.nextDueDate
                  : null,

              note:
                typeof data.note === "string"
                  ? data.note
                  : null,

              file:
                data.file &&
                typeof data.file === "object"
                  ? data.file
                  : null,

               files:
            Array.isArray(data.files)
                ? data.files
                : [],   
            };
          });

        nextRecords.sort((a, b) => {
          const aTime =
            a.completedAt?.getTime() ||
            a.createdAt?.getTime() ||
            0;

          const bTime =
            b.completedAt?.getTime() ||
            b.createdAt?.getTime() ||
            0;

          return bTime - aTime;
        });

        setRecords(nextRecords);
        setLoading(false);
      },
      snapshotError => {
        console.log(
          "Compliance history failed:",
          snapshotError.message
        );

        setError(snapshotError.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [requirementId, driverId]);

async function deleteRecord(
  recordId: string
) {
  const carrierId =
    auth.currentUser?.uid;

  if (!carrierId || !recordId) {
    throw new Error(
      "Unable to identify this compliance record."
    );
  }

  const recordRef = driverId
    ? doc(
        db,
        "carriers",
        carrierId,
        "drivers",
        driverId,
        "complianceRecords",
        requirementId,
        "history",
        recordId
      )
    : doc(
        db,
        "carriers",
        carrierId,
        "complianceRecords",
        requirementId,
        "history",
        recordId
      );

  const targetRecord =
    records.find(
      record => record.id === recordId
    );

  /*
   * If we cannot identify the record, or this is
   * not the newest completion, delete history only.
   *
   * An older history deletion must never rewind
   * the current compliance state.
   */
  if (
    !targetRecord ||
    records[0]?.id !== recordId
  ) {
    await deleteDoc(recordRef);
    return;
  }

  /*
   * DRIVER REQUIREMENTS
   */
  if (driverId) {
    const driverField =
      requirementId === "mvr"
        ? "mvrDue"
        : requirementId ===
            "clearinghouse"
          ? "clearinghouseDue"
          : requirementId ===
              "medical"
            ? "medicalExpiration"
            : null;

    if (!driverField) {
      await deleteDoc(recordRef);
      return;
    }

    const driverRef = doc(
      db,
      "carriers",
      carrierId,
      "drivers",
      driverId
    );

    const driverSnapshot =
      await getDoc(driverRef);

    if (!driverSnapshot.exists()) {
      await deleteDoc(recordRef);
      return;
    }

    const currentValue =
      driverSnapshot.data()?.[
        driverField
      ];

    /*
     * MVR and Clearinghouse store the completion
     * date as the live driver value.
     *
     * Medical stores the actual expiration date.
     */
    const expectedCurrentValue =
      requirementId === "medical"
        ? targetRecord.nextDueDate
        : targetRecord.completionDate;

    /*
     * If the user manually changed the live value
     * after this completion, preserve their edit.
     */
    if (
      !expectedCurrentValue ||
      currentValue !== expectedCurrentValue
    ) {
      await deleteDoc(recordRef);
      return;
    }

    const restoredValue =
      targetRecord.previousCompletionDate ??
      "";

    const batch = writeBatch(db);

    batch.set(
      driverRef,
      {
        [driverField]:
          restoredValue,

        lastUpdated:
          serverTimestamp(),
      },
      {
        merge: true,
      }
    );

    batch.delete(recordRef);

    await batch.commit();
    return;
  }

  /*
   * COMPANY REQUIREMENTS
   */
  const complianceRef = doc(
    db,
    "carriers",
    carrierId,
    "compliance",
    requirementId
  );

  const complianceSnapshot =
    await getDoc(complianceRef);

  if (!complianceSnapshot.exists()) {
    await deleteDoc(recordRef);
    return;
  }

  const liveData =
    complianceSnapshot.data();

  /*
   * Recurring/date-based requirement.
   *
   * Only rewind if the live due date still
   * matches the due date produced by the
   * completion being deleted.
   */
  if (targetRecord.nextDueDate) {
    if (
      liveData?.dueDate !==
      targetRecord.nextDueDate
    ) {
      await deleteDoc(recordRef);
      return;
    }

    const batch = writeBatch(db);

    batch.set(
      complianceRef,
      {
        dueDate:
          targetRecord.previousDueDate,

        enteredDate:
          targetRecord.previousEnteredDate,

        previousDueDate: null,

        completed: false,
        completedDate: null,
        completedAt: null,

        lastUpdated:
          serverTimestamp(),

        notified30: false,
        notified90: false,
      },
      {
        merge: true,
      }
    );

    batch.delete(recordRef);

    await batch.commit();
    return;
  }

  /*
   * One-time requirement such as BOC-3.
   */
  if (liveData?.completed !== true) {
    await deleteDoc(recordRef);
    return;
  }

  const liveCompletionDate =
    typeof liveData?.completedDate ===
    "string"
      ? liveData.completedDate
      : null;

  if (
    targetRecord.completionDate &&
    liveCompletionDate &&
    liveCompletionDate !==
      targetRecord.completionDate
  ) {
    await deleteDoc(recordRef);
    return;
  }

  const batch = writeBatch(db);

  batch.set(
    complianceRef,
    {
      completed: false,
      completedDate: null,
      completedAt: null,

      lastUpdated:
        serverTimestamp(),

      notified30: false,
      notified90: false,
    },
    {
      merge: true,
    }
  );

  batch.delete(recordRef);

  await batch.commit();
}

  return {
  records,
  loading,
  error,
  deleteRecord,
};
}