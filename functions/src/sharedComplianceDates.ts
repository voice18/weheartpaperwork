// Shared by the customer dashboard and the managed owner service.
// A due date is a calendar day, never a timestamp.
export function validComplianceDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(value + "T00:00:00Z");
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? value : null;
}

export function complianceToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find(value => value.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function complianceDaysFrom(due: string | null, current = complianceToday()): number | null {
  if (!validComplianceDate(due) || !validComplianceDate(current)) return null;
  return Math.round((Date.parse(due + "T00:00:00Z") - Date.parse(current + "T00:00:00Z")) / 86400000);
}

export function complianceAddDays(value: string, amount: number): string {
  if (!validComplianceDate(value) || !Number.isInteger(amount)) return "";
  const next = new Date(value + "T00:00:00Z");
  next.setUTCDate(next.getUTCDate() + amount);
  return next.toISOString().slice(0, 10);
}

export function complianceAddYears(value: string, amount: number): string {
  if (!validComplianceDate(value) || !Number.isInteger(amount)) return "";
  const [year, month, day] = value.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year + amount, month, 0)).getUTCDate();
  return `${year + amount}-${String(month).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

export function complianceUsdotDue(usdot: string, current = complianceToday()): string | null {
  const raw = usdot.replace(/\D/g, "");
  if (raw.length < 2) return null;
  const penultimate = Number(raw[raw.length - 2]);
  const last = Number(raw[raw.length - 1]);
  const month = last === 0 ? 10 : last;
  const year = Number(current.slice(0, 4));
  const dueYear = year % 2 === penultimate % 2 ? year : year + 1;
  const lastDay = new Date(Date.UTC(dueYear, month, 0)).getUTCDate();
  return `${dueYear}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

export function complianceNextIftaQuarterDue(current = complianceToday()): string {
  const year = Number(current.slice(0, 4));
  const candidates = [`${year}-04-30`, `${year}-07-31`, `${year}-10-31`, `${year + 1}-01-31`];
  return candidates.find(candidate => candidate >= current) || `${year + 1}-04-30`;
}

export function complianceFollowingIftaQuarterDue(due: string): string | null {
  if (!validComplianceDate(due)) return null;
  const year = Number(due.slice(0, 4));
  const month = Number(due.slice(5, 7));
  return month === 1 ? `${year}-04-30` : month === 4 ? `${year}-07-31`
    : month === 7 ? `${year}-10-31` : month === 10 ? `${year + 1}-01-31` : null;
}

export function complianceIftaQuarterEnd(due: string): string | null {
  if (!validComplianceDate(due)) return null;
  const year = Number(due.slice(0, 4));
  const month = Number(due.slice(5, 7));
  return month === 4 ? `${year}-03-31` : month === 7 ? `${year}-06-30`
    : month === 10 ? `${year}-09-30` : month === 1 ? `${year - 1}-12-31` : null;
}

export function complianceFixedCalendarDue(id: string, current = complianceToday()): string | null {
  const year = current.slice(0, 4);
  return id === "tax2290" ? `${year}-08-31`
    : id === "ucr" || id === "ifta" ? `${year}-12-31` : null;
}
