// store/useComplianceStore.ts
// ─────────────────────────────────────────────────────────────────────────────
// Central state store using Zustand.
// All reads/writes go through here — components never call Firestore directly.
// ─────────────────────────────────────────────────────────────────────────────

import { create }            from "zustand";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import type { ComplianceRecord, RequirementId } from "../lib/types";
import {
  addDays,
  addYears,
  calcUsdotDue,
} from "../lib/requirements";

function fixedCalendarDueDate(
  reqId: RequirementId
): string | null {
  const year = new Date().getFullYear();

  switch (reqId) {
    case "tax2290":
      return `${year}-08-31`;

    case "ucr":
    case "ifta":
      return `${year}-12-31`;

    default:
      return null;
  }
}

interface StoreState {
  carrierId:   string | null;
  usdotNumber: string;
  compliance:  Record<string, ComplianceRecord>;
  loading:     boolean;
  error:       string | null;

  // Actions
  init:             (carrierId: string) => () => void;
  setUsdot:        (num: string) => void;
  saveDate:        (reqId: RequirementId, enteredDate: string, dueDate: string) => Promise<void>;
  markComplete: (
  reqId: RequirementId,
  completionDate?: string | null
) => Promise<void>;
  markIncomplete:  (reqId: RequirementId) => Promise<void>;
  setApplicable: ( reqId: RequirementId, applicable: boolean) => Promise<void>;
}

export const useComplianceStore = create<StoreState>((set, get) => ({

  carrierId:   null,
  usdotNumber: "",
  compliance:  {},
  loading:     true,
  error:       null,


  // ── init ───────────────────────────────────────────────────────────────────
  // Call once after auth — sets up a real-time Firestore listener so the UI
  // updates instantly whenever any record changes (works across devices too).
  init(carrierId) {
    set({ carrierId, loading: true });

    // Load USDOT number from carrier doc
   getDoc(doc(db, "carriers", carrierId))
  .then(snap => {
    if (snap.exists()) {
      set({ usdotNumber: snap.data().usdotNumber || "" });
    }
  })
  .catch(err => {
    console.log("Carrier doc failed:", err.message);
  });

    // Real-time listener on the compliance sub-collection
    const compRef = collection(db, "carriers", carrierId, "compliance");
    const unsub = onSnapshot(compRef, snapshot => {
      const records: Record<string, ComplianceRecord> = {};
      snapshot.forEach(d => {
        const data = d.data();
        records[d.id] = {
          dueDate:     data.dueDate     || null,
          enteredDate: data.enteredDate || null,
          completed:   data.completed   || false,
          completedAt: data.completedAt
            ? (data.completedAt as Timestamp).toDate()
            : null,
          lastUpdated: data.lastUpdated
            ? (data.lastUpdated as Timestamp).toDate()
            : new Date(),
          notified30: data.notified30 || false,
          notified90: data.notified90 || false,

          applicable: data.applicable !== false,
        };
      });
      set({ compliance: records, loading: false });
    }, err => {
      set({ error: err.message, loading: false });
    });

    // Return unsub so the component can clean up if needed
    // (store it externally or call via an effect)
    return unsub;
  },

  // ── setUsdot ───────────────────────────────────────────────────────────────
  async setUsdot(num) {
    const { carrierId } = get();
    set({ usdotNumber: num });
    if (!carrierId) return;
    await setDoc(doc(db, "carriers", carrierId), { usdotNumber: num }, { merge: true });
  },

  // ── saveDate ───────────────────────────────────────────────────────────────
  // enteredDate = what the user typed (e.g. last inspection date)
  // dueDate     = calculated next due date (computed in the UI layer)
  async saveDate(reqId, enteredDate, dueDate) {
    const { carrierId } = get();
    if (!carrierId) return;
    const ref = doc(db, "carriers", carrierId, "compliance", reqId);
    await setDoc(ref, {
      enteredDate,
      dueDate,
      completed:   false,
      completedAt: null,
      lastUpdated: serverTimestamp(),
      notified30:  false,   // reset alerts when date changes
      notified90:  false,
    }, { merge: true });
  },

      // ── setApplicable ────────────────────────────────────────────────────────────
async setApplicable(
  reqId,
  applicable
) {
  const { carrierId } = get();

  if (!carrierId) {
    return;
  }

  const ref = doc(
    db,
    "carriers",
    carrierId,
    "compliance",
    reqId
  );

  await setDoc(
    ref,
    {
      applicable,
      notified30: false,
      notified90: false,
      lastUpdated:
        serverTimestamp(),
    },
    {
      merge: true,
    }
  );
},

  // ── markComplete ───────────────────────────────────────────────────────────
 // ── markComplete ───────────────────────────────────────────────────────────
async markComplete(reqId, completionDate = null) {
  const { carrierId, compliance, usdotNumber } = get();

  if (!carrierId) {
    return;
  }

  const user = auth.currentUser;

  const complianceRef = doc(
    db,
    "carriers",
    carrierId,
    "compliance",
    reqId
  );

  const recordRef = doc(
  collection(
    db,
    "carriers",
    carrierId,
    "complianceRecords",
    reqId,
    "history"
  )
);

  let complianceUpdate: Record<string, unknown>;
  let previousDueDate: string | null = null;
  let nextDueDate: string | null = null;

  const previousEnteredDate =
  compliance[reqId]?.enteredDate || null;

  if (reqId === "mcs150") {
      const currentDue =
        compliance[reqId]?.dueDate ||
        calcUsdotDue(usdotNumber);

      if (!currentDue || !completionDate) {
        return;
      }

      previousDueDate = currentDue;

      /*
      * FMCSA rule:
      * An MCS-150 update filed during the 12 months
      * immediately preceding a scheduled biennial
      * due date satisfies that biennial cycle.
      *
      * Updates made earlier than that do NOT move
      * the scheduled biennial due date.
      */
      let candidateDue = currentDue;

      while (true) {
        const windowStart = addYears(
          candidateDue,
          -1
        );

        if (!windowStart) {
          return;
        }

        if (completionDate < windowStart) {
          break;
        }

        const followingDue = addYears(
          candidateDue,
          2
        );

        if (!followingDue) {
          return;
        }

        candidateDue = followingDue;
      }

      nextDueDate = candidateDue;

      complianceUpdate = {
        enteredDate: completionDate,
        dueDate: nextDueDate,
        completed: false,
        completedAt: null,
        lastUpdated: serverTimestamp(),
        notified30: false,
        notified90: false,
      };
    } else if (
      reqId === "irp" ||
      reqId === "drug"
    ) {
    const currentDue =
      compliance[reqId]?.dueDate ||
      compliance[reqId]?.enteredDate;

    if (!currentDue) {
      return;
    }

    previousDueDate = currentDue;
      nextDueDate = addYears(
        currentDue,
        1
      );

      if (!nextDueDate) {
        return;
      }

    

    complianceUpdate = {
      enteredDate: currentDue,
      dueDate: nextDueDate,
      completed: false,
      completedAt: null,
      lastUpdated: serverTimestamp(),
      notified30: false,
      notified90: false,
    };
  } else {
    const fixedCalendarIds: RequirementId[] = [
      "tax2290",
      "ucr",
      "ifta",
    ];

          if (fixedCalendarIds.includes(reqId)) {
        const currentDue =
          compliance[reqId]?.dueDate ||
          compliance[reqId]?.enteredDate ||
          fixedCalendarDueDate(reqId);

        if (!currentDue) {
          return;
        }

      const [year, month, day] =
        currentDue
          .split("-")
          .map(Number);

      nextDueDate =
        `${year + 1}-` +
        `${String(month).padStart(2, "0")}-` +
        `${String(day).padStart(2, "0")}`;

      previousDueDate = currentDue;

      complianceUpdate = {
        previousDueDate: currentDue,
        dueDate: nextDueDate,

        completed: false,
        completedDate: null,
        completedAt: null,

        lastUpdated:
          serverTimestamp(),
        notified30: false,
        notified90: false,
      };
    } else {
      const renewalRules: Record<
        string,
        {
          years?: number;
          days?: number;
        }
      > = {
        clearinghouse: {
          years: 1,
        },
        mvr: {
          years: 1,
        },
        "fmcsa-portal": {
          days: 90,
        },
      };

      const rule =
        renewalRules[reqId];

      const currentDue =
        completionDate ||
        compliance[reqId]?.dueDate ||
        compliance[reqId]?.enteredDate;

      if (rule && currentDue) {
        nextDueDate = rule.years
          ? addYears(
              currentDue,
              rule.years
            )
          : rule.days
            ? addDays(
                currentDue,
                rule.days
              )
            : null;

        if (!nextDueDate) {
          return;
        }

        complianceUpdate = {
          enteredDate: currentDue,
          dueDate: nextDueDate,
          completed: false,
          completedAt: null,
          lastUpdated:
            serverTimestamp(),
          notified30: false,
          notified90: false,
        };
      } else {
        previousDueDate =
          compliance[reqId]?.dueDate ||
          null;

        complianceUpdate = {
          completed: true,
          completedDate:
            completionDate || null,
          completedAt:
            serverTimestamp(),
          lastUpdated:
            serverTimestamp(),
        };
      }
    }
  }

  const batch = writeBatch(db);

  batch.set(
    recordRef,
    {
      recordType: "completion",
      requirementId: reqId,
      carrierId,

      completionDate:
        completionDate || null,
      completedAt:
        serverTimestamp(),

      completedByUserId:
        user?.uid || null,
      completedByName:
        user?.displayName ||
        user?.email ||
        "Account owner",

      previousDueDate,
      previousEnteredDate,
      nextDueDate,

      note: null,
      file: null,


      source: "company",
      createdAt:
        serverTimestamp(),
    }
  );

  batch.set(
    complianceRef,
    complianceUpdate,
    {
      merge: true,
    }
  );

  await batch.commit();
},
  // ── markIncomplete (undo) ──────────────────────────────────────────────────
 async markIncomplete(reqId) {
  const { carrierId } = get();
  if (!carrierId) return;

  const ref = doc(
    db,
    "carriers",
    carrierId,
    "compliance",
    reqId
  );

  const snapshot = await getDoc(ref);
  const data = snapshot.data();

  const previousDueDate =
    typeof data?.previousDueDate === "string"
      ? data.previousDueDate
      : null;

  const fallbackDueDate =
    fixedCalendarDueDate(reqId);

  const restoredDueDate =
    previousDueDate || fallbackDueDate;

  if (restoredDueDate) {
    await setDoc(
      ref,
      {
        dueDate: restoredDueDate,
        previousDueDate: null,

        completed: false,
        completedDate: null,
        completedAt: null,

        lastUpdated: serverTimestamp(),
        notified30: false,
        notified90: false,
      },
      { merge: true }
    );

    return;
  }

  await setDoc(
    ref,
    {
      completed: false,
      completedDate: null,
      completedAt: null,
      lastUpdated: serverTimestamp(),
    },
    { merge: true }
  );
},
}));