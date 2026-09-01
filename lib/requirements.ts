// lib/requirements.ts
// ─────────────────────────────────────────────────────────────────────────────
// Pure functions — no React, no platform code.
// Used by BOTH the web dashboard and the React Native screens.
// ─────────────────────────────────────────────────────────────────────────────

import type { ComplianceRecord, RequirementId } from "./types";
import type { CustomRequirementIntervalUnit } from "./types";



export const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
export const MONTH_MAP: Record<string, number> = {"1":0,"2":1,"3":2,"4":3,"5":4,"6":5,"7":6,"8":7,"9":8,"0":9};

export function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
export const daysFrom = (s: string | null, today = new Date()): number | null => {
  if (!s) return null;

  const [year, month, day] = s.split("-").map(Number);
  if (!year || !month || !day) return null;
  const dueUtc = Date.UTC(year, month - 1, day);
  const dueCheck = new Date(dueUtc);
  if (
    dueCheck.getUTCFullYear() !== year ||
    dueCheck.getUTCMonth() !== month - 1 ||
    dueCheck.getUTCDate() !== day
  ) return null;
  const todayUtc = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  // Compare calendar dates rather than local-midnight timestamps. This keeps
  // the dashboard stable across 23-hour and 25-hour daylight-saving days and
  // matches the UTC calendar arithmetic used by the notification service.
  return Math.round((dueUtc - todayUtc) / 86400000);
};

export const fmtDate = (s: string | null): string =>
  s ? new Date(s + "T00:00:00").toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" }) : "—";

export const addYears = (
  s: string,
  y: number
): string => {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);

  if (!match) {
    return "";
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const targetYear = year + y;

  const lastDayOfTargetMonth =
    new Date(
      targetYear,
      month,
      0
    ).getDate();

  const targetDay = Math.min(
    day,
    lastDayOfTargetMonth
  );

  return (
    `${targetYear}-` +
    `${String(month).padStart(2, "0")}-` +
    `${String(targetDay).padStart(2, "0")}`
  );
};

export const addDays = (s: string, n: number): string => {
  const d = new Date(s + "T00:00:00");

  if (Number.isNaN(d.getTime())) return "";

  d.setDate(d.getDate() + n);

  return localDateString(d);
};

export function addInterval(
  dateString: string,
  value: number,
  unit: CustomRequirementIntervalUnit
): string {
  if (!Number.isInteger(value) || value < 1) return "";
  if (unit === "day") return addDays(dateString, value);
  if (unit === "week") return addDays(dateString, value * 7);
  if (unit === "year") return addYears(dateString, value);

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (!match) return "";
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const sourceLastDay = new Date(year, monthIndex + 1, 0).getDate();
  const sourceIsMonthEnd = day === sourceLastDay;
  const targetMonthIndex = monthIndex + value;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();

  return `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(
    sourceIsMonthEnd ? lastDay : Math.min(day, lastDay)
  ).padStart(2, "0")}`;
}

export type CalendarPeriodFrequency = "monthly" | "quarterly";

export function calendarPeriodEnd(
  referenceDate: string,
  frequency: CalendarPeriodFrequency
): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(referenceDate);
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const endMonth = frequency === "monthly"
    ? month
    : Math.ceil(month / 3) * 3;
  const day = new Date(year, endMonth, 0).getDate();
  return `${year}-${String(endMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function nextCalendarPeriodEnd(
  currentPeriodEnd: string,
  frequency: CalendarPeriodFrequency
): string {
  const advanced = addInterval(
    currentPeriodEnd,
    frequency === "monthly" ? 1 : 3,
    "month"
  );
  return advanced ? calendarPeriodEnd(advanced, frequency) : "";
}

export const eoy = (): string => {
  const today = new Date();
  return `${today.getFullYear()}-12-31`;
};

export function nextIftaQuarterDue(referenceDate = localDateString()): string {
  const [year] = referenceDate.split("-").map(Number);
  const candidates = [
    `${year}-04-30`,
    `${year}-07-31`,
    `${year}-10-31`,
    `${year + 1}-01-31`,
  ];

  return candidates.find(date => date >= referenceDate) || `${year + 1}-04-30`;
}

export function followingIftaQuarterDue(currentDueDate: string): string {
  const [year, month] = currentDueDate.split("-").map(Number);

  if (month === 1) return `${year}-04-30`;
  if (month === 4) return `${year}-07-31`;
  if (month === 7) return `${year}-10-31`;
  return `${year + 1}-01-31`;
}

export function iftaQuarterEndFromDueDate(dueDate: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueDate);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);

  if (month === 4) return `${year}-03-31`;
  if (month === 7) return `${year}-06-30`;
  if (month === 10) return `${year}-09-30`;
  if (month === 1) return `${year - 1}-12-31`;
  return null;
}

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
  filingPeriodEnd?: string | null;
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

if (reqId === "ifta-quarterly") {
  return nextIftaQuarterDue(enteredDate);
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
  const currentYear = new Date().getFullYear();
  const tax2290DefaultDue = `${currentYear}-08-31`;
  const yearEndDefaultDue = `${currentYear}-12-31`;
  const iftaQuarterlyDefaultDue = nextIftaQuarterDue();

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
    { id:"mcs150",       n:"MCS-150 / USDOT biennial update",            f:"Changes within 30 days · biennial",        due: r("mcs150").dueDate || ud,                                             de:true, dateMode: "fixed-user-date",  dl: "Next MCS-150 due date",  crit:true, attentionDays: 30,
      notes:"Update your FMCSA registration within 30 days whenever company information changes. A biennial update is also required every 2 years on your USDOT-number schedule. An MCS-150 update filed within 12 months before the scheduled biennial due date satisfies that biennial cycle.",
      cons:"Failure can deactivate your USDOT number and halt all operations.", act:"Open MCS-150 walkthrough", lnk:"https://weheartpaperwork.com/how-to/update-mcs-150-motus", completed: r("mcs150").completed, applicable:isApplicable("mcs150"), canBeNotApplicable: true, },
    {
      id: "tax2290",
      n: "2290 heavy vehicle use tax",
      f: "Annual · July-use fleet",
      due:
        r("tax2290").dueDate ||
        tax2290DefaultDue,
      de: false,
      dateMode: "fixed-calendar",
      attentionDays: 30,
      notes:
        "For taxable vehicles first used on public highways in July, Form 2290 is generally due August 31. If an additional taxable vehicle is first used later in the tax period, a separate Form 2290 is generally due by the last day of the following month, with tax prorated for the remaining tax period.",
      cons:
        "Missing or late Form 2290 filing can result in IRS penalties and leave you without current proof of Heavy Vehicle Use Tax payment.",

      act: "Open Form 2290 walkthrough",
      lnk:
        "https://weheartpaperwork.com/how-to/file-form-2290",

      completed:
        r("tax2290").completed,
      applicable:
        isApplicable("tax2290"),
      canBeNotApplicable: true,
      },
    {
        id: "fmcsa-portal",
        n: "FMCSA Portal account access",
        f: "Login at least every 90 days",
        due:
          r("fmcsa-portal").dueDate ||
          (
            r("fmcsa-portal").enteredDate
              ? addDays(
                  r("fmcsa-portal").enteredDate as string,
                  90
                )
              : null
          ),
        de: true,
        dateMode: "rolling",
        dl: "Last Portal login date",
        attentionDays: 10,

        notes:
          "FMCSA Portal accounts are disabled after 90 days and archived after 12 months of inactivity. Registration actions have moved to Motus, but the Portal remains in use for certain FMCSA systems.",

        cons:
          "A disabled Portal account can prevent access to FMCSA systems that still use the Portal.",

        act: "Log into FMCSA Portal",

        completed:
          r("fmcsa-portal").completed,

        applicable:
          isApplicable("fmcsa-portal"),

        canBeNotApplicable: true,
      },
    { id:"ucr",          n:"UCR — unified carrier registration",          f: "Annual · due Dec 31",               due: r("ucr").dueDate || yearEndDefaultDue,                                        de:false, dateMode: "fixed-calendar",  attentionDays: 30,
      notes:"Renew before Jan 1. Fees are fleet-size based.",
      cons:"Operating without valid UCR is a federal violation.", act:"Renew UCR", lnk:"https://www.ucr.gov", completed: r("ucr").completed, applicable:isApplicable("ucr"), canBeNotApplicable: true, },
    { id:"ifta",         n:"IFTA license & decals annual renewal",                        f:"Annual · due Dec 31",               due: r("ifta").dueDate || yearEndDefaultDue,                                        de:false, dateMode: "fixed-calendar", attentionDays: 30,
      notes:"IFTA license and decals renew annually through your base jurisdiction. Quarterly IFTA fuel tax returns are tracked separately below.",
      cons:"Operating without valid IFTA credentials may require trip permits and can result in citations.", act:"Renew IFTA license and decals", completed: r("ifta").completed, applicable:isApplicable("ifta"), canBeNotApplicable: true, },
    { id:"ifta-quarterly", n:"IFTA quarterly fuel tax return", f:"Quarterly · Apr 30, Jul 31, Oct 31, Jan 31", due: r("ifta-quarterly").dueDate || iftaQuarterlyDefaultDue, filingPeriodEnd: iftaQuarterEndFromDueDate(r("ifta-quarterly").dueDate || iftaQuarterlyDefaultDue), de:false, dateMode:"fixed-calendar", attentionDays:5,
      notes:"Interstate carriers operating qualified motor vehicles under IFTA generally file one fuel tax return with their base jurisdiction every quarter. A return may still be required when there was no travel. Intrastate-only carriers can mark this requirement Does not apply.",
      cons:"Late or missing returns can result in penalties, interest, or problems with IFTA credentials.", act:"File quarterly IFTA return", completed:r("ifta-quarterly").completed, applicable:isApplicable("ifta-quarterly"), canBeNotApplicable:true, },
    { id:"irp",          n:"IRP apportioned registration renewal",        f:"Annual · jurisdiction-specific",               due: r("irp").dueDate     || r("irp").enteredDate          || null,               de:true, dateMode: "fixed-user-date", dl:"IRP expiration / renewal due date", attentionDays: 30,
      notes:"State-specific renewal. Enter the actual IRP expiration date from your registration.",
      cons:"Expired apportioned registration can stop interstate operations.", act:"Renew IRP registration", completed: r("irp").completed, applicable:isApplicable("irp"), canBeNotApplicable: true, },
    { id:"insurance",    n:"Commercial auto insurance renewal",           f:"Policy expiration date",                        due: r("insurance").dueDate || r("insurance").enteredDate || null,             de:true, dateMode: "fixed-user-date", dl:"Commercial auto insurance expiration date", attentionDays: 30,
      notes:"Enter the expiration date shown on your current commercial auto insurance policy.",
      cons:"A lapse in required insurance can interrupt operating authority and leave the company unable to operate.", act:"Renew commercial auto insurance", completed: r("insurance").completed, applicable:isApplicable("insurance"), canBeNotApplicable: true, },
    { id:"drug",         n:"Drug & alcohol consortium Renewal",        f:"Annual · provider-specific",           due: r("drug").dueDate || r("drug").enteredDate || null,               de:true, dateMode: "fixed-user-date", dl:"Consortium membership renewal due date", attentionDays: 30,
      notes:"Enter the annual renewal date provided by your drug and alcohol consortium. FMCSA requires continuous program enrollment, but the renewal date is set by your chosen provider.", 
      cons:"A lapse in consortium enrollment can leave the company without a compliant DOT drug and alcohol testing program.", act:"Renew consortium membership", completed: r("drug").completed, applicable:isApplicable("drug"), canBeNotApplicable: true, },
    {
      id: "boc3",
      n: "BOC-3 process agent filing",
      f: "One-time · maintain valid designation",
      due: null,
      de: false,
      dateMode: "none",
      notes:
        "Keep a valid process agent designation on file with FMCSA. File a new BOC-3 if the designation changes or becomes invalid, or when FMCSA requires a new filing after an operating-authority change.",
      cons:
        "An invalid or missing BOC-3 can prevent or jeopardize active operating authority.",
      act: "Confirm BOC-3 is active",
      completed: r("boc3").completed,
      applicable: isApplicable("boc3"),
      canBeNotApplicable: true,
    },
  ];
}

// ── Urgency classifier ────────────────────────────────────────────────────────
export type UrgencyLevel = "od" | "sn" | "up" | "ok" | "unk" | "done"| "na";

type UrgencyRequirement = {
  id: string;
  due: string | null;
  completed: boolean;
  attentionDays?: number;
  filingPeriodEnd?: string | null;
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

  if (r.filingPeriodEnd) {
    const periodDaysRemaining = daysFrom(r.filingPeriodEnd);
    if (periodDaysRemaining === null) return "unk";
    if (periodDaysRemaining < 0) return "sn";
    return periodDaysRemaining <= (r.attentionDays ?? 5) ? "sn" : "ok";
  }

  const attentionWindow = r.attentionDays ?? 30;

  if (daysRemaining <= attentionWindow) return "sn";

  return "ok";
}
