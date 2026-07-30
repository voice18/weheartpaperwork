import { useEffect, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  Timestamp,
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

  await deleteDoc(recordRef);
}

  return {
  records,
  loading,
  error,
  deleteRecord,
};
}