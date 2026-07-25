// lib/requirements.ts
// ─────────────────────────────────────────────────────────────────────────────
// Pure functions — no React, no platform code.
// Used by BOTH the web dashboard and the React Native screens.
// ─────────────────────────────────────────────────────────────────────────────

import type { ComplianceRecord, RequirementId } from "./types";



export const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
export const MONTH_MAP: Record<string, number> = {"1":0,"2":1,"3":2,"4":3,"5":4,"6":5,"7":6,"8":7,"9":8,"0":9};

export function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
export const daysFrom = (s: string | null): number | null => {
  if (!s) return null;

  const [year, month, day] = s.split("-").map(Number);
  if (!year || !month || !day) return null;

  const due = new Date(year, month - 1, day);
  const today = new Date();

  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return Math.floor((due.getTime() - today.getTime()) / 86400000);
};

export const fmtDate = (s: string | null): string =>
  s ? new Date(s + "T00:00:00").toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" }) : "—";

export const addYears = (s: string, y: number): string => {
  const d = new Date(s + "T00:00:00");

  if (Number.isNaN(d.getTime())) return "";

  d.setFullYear(d.getFullYear() + y);

  return localDateString(d);
};

export const addDays = (s: string, n: number): string => {
  const d = new Date(s + "T00:00:00");

  if (Number.isNaN(d.getTime())) return "";

  d.setDate(d.getDate() + n);

  return localDateString(d);
};

export const eoy = (): string => {
  const today = new Date();
  return `${today.getFullYear()}-12-31`;
};

// ── USDOT due date calculator ─────────────────────────────────────────────────
export function calcUsdotDue(usdot: string): string | null {
  const raw = usdot.replace(/\D/g, "");
  if (raw.length < 2) return null;
  const pen = raw[raw.length - 2], last = raw[raw.length - 1];
  const isOdd = parseInt(pen) % 2 !== 0;
  const mo = MONTH_MAP[last] ?? 0;
  const yr = new Date().getFullYear();
  const ty = isOdd ? (yr % 2 !== 0 ? yr : yr + 1) : (yr % 2 === 0 ? yr : yr + 1);
  const ld = new Date(ty, mo + 1, 0).getDate();
  return `${ty}-${String(mo+1).padStart(2,"0")}-${String(ld).padStart(2,"0")}`;
}
export type RequirementDateMode =
  | "fixed-calendar"
  | "fixed-user-date"
  | "rolling"
  | "none";
// ── Build requirement list from Firestore data ────────────────────────────────
export interface Requirement {
  id: RequirementId;
  n: string;
  f: string;
  due: string | null;
  de: boolean | "usdot";
  dateMode: RequirementDateMode;
  dl?: string;
  dr?: boolean;
  crit?: boolean;
  attentionDays?: number;
  notes: string;
  cons: string;
  act: string;
  lnk?: string;
  completed: boolean;

  /**
   * Missing Firestore values default to active.
   */
  applicable: boolean;

  /**
   * Whether the UI displays the reversible
   * "Does not apply" control.
   */
  canBeNotApplicable: boolean;
}
export function calculateNextDue(reqId: string, enteredDate: string): string | null {
  if (!enteredDate) return null;

  const d = new Date(enteredDate + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;

  if (reqId === "tax2290") {
  const today = new Date();
  const year = today.getFullYear();
  
  const thisYearDue = new Date(`${year}-08-31T00:00:00`);
  const dueYear = today > thisYearDue ? year + 1 : year;
  return `${dueYear}-08-31`;
}

if (reqId === "ucr") {
  const today = new Date();
  const year = today.getFullYear();
  const thisYearDue = new Date(`${year}-12-31T00:00:00`);

  const dueYear = today > thisYearDue ? year + 1 : year;

  return `${dueYear}-12-31`;
}

if (reqId === "ifta") {
  const today = new Date();
  const year = today.getFullYear();
  const thisYearDue = new Date(`${year}-12-31T00:00:00`);

  const dueYear = today > thisYearDue ? year + 1 : year;

  return `${dueYear}-12-31`;
}

  if (reqId === "medical") {
    d.setFullYear(d.getFullYear() + 2);
    return d.toISOString().split("T")[0];
  }

  if (reqId === "clearinghouse" || reqId === "mvr" || reqId === "inspection") {
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split("T")[0];
  }

  if (reqId === "fmcsa-portal") {
    d.setDate(d.getDate() + 90);
    return d.toISOString().split("T")[0];
  }

  return enteredDate;
}
export function buildReqs(
  compliance: Record<string, ComplianceRecord>,
  usdotNumber: string
): Requirement[] {
  const c  = compliance;
  const ud = calcUsdotDue(usdotNumber);

  const r = (
  id: RequirementId
): ComplianceRecord =>
  c[id] ?? {
    dueDate: null,
    enteredDate: null,
    completed: false,
    completedAt: null,
    lastUpdated: new Date(),
    notified30: false,
    notified90: false,
    applicable: true,
  };

const isApplicable = (
  id: RequirementId
): boolean =>
  r(id).applicable !== false;

  return [ 
    { id:"mcs150",       n:"MCS-150 / USDOT biennial update",            f:"Every 2 years",        due: r("mcs150").dueDate ||  r("mcs150").enteredDate || ud,                                             de:true, dateMode: "fixed-user-date",  dl: "Next MCS-150 due date",  crit:true, attentionDays: 30,
      notes:"Required every 2 years even if nothing changed. Date is calculated from your USDOT number.",
      cons:"Failure can deactivate your USDOT number and halt all operations.", act:"File MCS-150 update", lnk:"https://portal.fmcsa.dot.gov", completed: r("mcs150").completed, applicable:isApplicable("mcs150"), canBeNotApplicable: true, },
    { id:"tax2290",      n:"2290 heavy vehicle use tax",                  f:"Annual",               due: r("tax2290").dueDate ||     "2026-08-31",                                        de:false, dateMode: "fixed-calendar", attentionDays: 30,
      notes:"Due Aug 31 for vehicles in service as of July 1.",
      cons:"Late penalty: 4.5% per month, up to 5 months.", act:"File Form 2290", lnk:"https://www.irs.gov/businesses/small-businesses-self-employed/trucking-tax-center", completed: r("tax2290").completed, applicable:isApplicable("tax2290"), canBeNotApplicable: true, },
    { id:"fmcsa-portal", n:"FMCSA portal account maintenance",            f:"Every 90 days",        due: r("fmcsa-portal").dueDate || (r("fmcsa-portal").enteredDate  ? addDays(r("fmcsa-portal").enteredDate as string, 90) : null), de:true, dateMode: "rolling", dl:"Last login date", attentionDays: 10,
      notes:"Log in every 90 days to prevent account deactivation.", 
      cons:"Inactive portal blocks filing updates and FMCSA responses.", act:"Log into FMCSA portal", lnk:"https://portal.fmcsa.dot.gov", completed: r("fmcsa-portal").completed, applicable:isApplicable("fmcsa-portal"), canBeNotApplicable: true, },
    { id:"ucr",          n:"UCR — unified carrier registration",          f: "Annual · due Dec 31",               due: r("ucr").dueDate           || "2026-12-31",                                        de:false, dateMode: "fixed-calendar",  attentionDays: 30,
      notes:"Renew before Jan 1. Fees are fleet-size based.",
      cons:"Operating without valid UCR is a federal violation.", act:"Renew UCR", lnk:"https://www.ucr.gov", completed: r("ucr").completed, applicable:isApplicable("ucr"), canBeNotApplicable: true, },
    { id:"ifta",         n:"IFTA license & decals annual renewal",                        f:"Annual · due Dec 31",               due: r("ifta").dueDate || "2026-12-31",                                        de:false, dateMode: "fixed-calendar", attentionDays: 30,
      notes:"IFTA license and decals renew annually through your base jurisdiction. This does not track quarterly IFTA fuel tax filings.",
      cons:"Expired IFTA decals risk fines and out-of-service at weigh stations.", act:"Renew IFTA license and decals", completed: r("ifta").completed, applicable:isApplicable("ifta"), canBeNotApplicable: true, },
    { id:"inspection",   n:"Annual vehicle inspections",                  f:"Every 12 months/CMV",  due: r("inspection").completed   ? null : r("inspection").enteredDate   ? addYears(r("inspection").enteredDate!,1)   : null, de:true, dateMode: "rolling", dl:"Date of last inspection", attentionDays: 30,
      notes:"Each truck and trailer needs annual FMCSA-compliant inspection.",
      cons:"Expired inspection = immediate out-of-service violation.", act:"Schedule fleet inspections", completed: r("inspection").completed, applicable:isApplicable("inspection"), canBeNotApplicable: true, },
    { id:"irp",          n:"IRP apportioned registration renewal",        f:"Annual · jurisdiction-specific",               due: r("irp").dueDate     || r("irp").enteredDate          || null,               de:true, dateMode: "fixed-user-date", dl:"IRP expiration / renewal due date", attentionDays: 30,
      notes:"State-specific renewal. Enter the actual IRP expiration date from your registration.",
      cons:"Expired apportioned registration can stop interstate operations.", act:"Renew IRP registration", completed: r("irp").completed, applicable:isApplicable("irp"), canBeNotApplicable: true, },
    { id:"drug",         n:"Drug & alcohol consortium Renewal",        f:"Annual · provider-specific",           due: r("drug").dueDate || r("drug").enteredDate || null,               de:true, dateMode: "fixed-user-date", dl:"Consortium membership renewal due date", attentionDays: 30,
      notes:"Enter the annual renewal date provided by your drug and alcohol consortium. FMCSA requires continuous program enrollment, but the renewal date is set by your chosen provider.", 
      cons:"A lapse in consortium enrollment can leave the company without a compliant DOT drug and alcohol testing program.", act:"Renew consortium membership", completed: r("drug").completed, applicable:isApplicable("drug"), canBeNotApplicable: true, },
    { id:"boc3",         n:"BOC-3 process agent filing",                  f:"One-time",             due: null,                                                                                      de:false, dateMode: "none",
      notes:"Only refile if process agent changes.",
      cons:"Missing BOC-3 prevents FMCSA from activating authority.", act:"Confirm agent is active", completed: r("boc3").completed, applicable:isApplicable("boc3"), canBeNotApplicable: true, },
  ];
}

// ── Urgency classifier ────────────────────────────────────────────────────────
export type UrgencyLevel = "od" | "sn" | "up" | "ok" | "unk" | "done"| "na";

type UrgencyRequirement = {
  id: string;
  due: string | null;
  completed: boolean;
  attentionDays?: number;
  applicable?: boolean;
};

export function urgency(r: UrgencyRequirement): UrgencyLevel {
  if (r.applicable === false) {
    return "na";
  }
  if (r.completed) return "done";
  if (!r.due) return "unk";

  const daysRemaining = daysFrom(r.due);

  if (daysRemaining === null) return "unk";
  if (daysRemaining < 0) return "od";

  const attentionWindow = r.attentionDays ?? 30;

  if (daysRemaining <= attentionWindow) return "sn";

  return "ok";
}
