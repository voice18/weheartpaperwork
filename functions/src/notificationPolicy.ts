export type AlertType = "15_days" | "5_days" | "due_today";
export type ReminderPolicy = "standard" | "five-day-and-due" | "due-day-only";

export type ReminderState = {
  dueDate: string;
  notified30: boolean;
  notified15: boolean;
  notified5: boolean;
  notifiedDue: boolean;
};

type RequirementData = Record<string, unknown>;

export const VEHICLE_NOTIFICATION_DEADLINES = [
  {
    field: "registrationExpiration",
    itemType: "registration",
    label: "Registration",
  },
  {
    field: "inspectionExpiration",
    itemType: "inspection",
    label: "Annual DOT inspection",
  },
] as const;

export function notificationDueDate(data: RequirementData): string | null {
  return typeof data.dueDate === "string" && data.dueDate.trim()
    ? data.dueDate.trim()
    : null;
}

export function customReminderPolicy(data: RequirementData): ReminderPolicy {
  if (data.scheduleType !== "rolling") return "standard";
  if (
    data.recurrenceKind === "calendar-monthly" ||
    data.recurrenceKind === "calendar-quarterly"
  ) return "five-day-and-due";

  const value = typeof data.intervalValue === "number" ? data.intervalValue : 1;
  if (data.intervalUnit === "year" || (data.intervalUnit === "month" && value >= 12)) {
    return "standard";
  }
  const approximateDays =
    data.intervalUnit === "day" ? value :
    data.intervalUnit === "week" ? value * 7 :
    data.intervalUnit === "month" ? value * 30 :
    data.intervalUnit === "year" ? value * 365 : 365;

  if (approximateDays <= 7) return "due-day-only";
  if (approximateDays < 365) return "five-day-and-due";
  return "standard";
}

export function getAlertDecision(
  days: number,
  dueDate: string,
  savedState: unknown,
  requirementId?: string,
  policy: ReminderPolicy = "standard"
): { alertType: AlertType; state: ReminderState } | null {
  if (days < 0) return null;

  const data = savedState && typeof savedState === "object"
    ? savedState as Partial<ReminderState>
    : {};
  const sameOccurrence = data.dueDate === dueDate;
  const state: ReminderState = {
    dueDate,
    notified30: sameOccurrence && data.notified30 === true,
    notified15: sameOccurrence && data.notified15 === true,
    notified5: sameOccurrence && data.notified5 === true,
    notifiedDue: sameOccurrence && data.notifiedDue === true,
  };

  if (requirementId === "fmcsa-portal") {
    if (days === 0 && !state.notifiedDue) {
      return { alertType: "due_today", state: { ...state, notified5: true, notifiedDue: true } };
    }
    if (days <= 5 && !state.notified5) {
      return { alertType: "5_days", state: { ...state, notified5: true } };
    }
    return null;
  }

  if (policy === "due-day-only") {
    if (days === 0 && !state.notifiedDue) {
      return { alertType: "due_today", state: { ...state, notifiedDue: true } };
    }
    return null;
  }

  if (days === 0 && !state.notifiedDue) {
    return {
      alertType: "due_today",
      state: { ...state, notified15: true, notified5: true, notifiedDue: true },
    };
  }

  if (requirementId === "ifta-quarterly" || policy === "five-day-and-due") {
    if (days <= 5 && !state.notified5) {
      return { alertType: "5_days", state: { ...state, notified5: true } };
    }
    return null;
  }

  if (days <= 5 && !state.notified5) {
    return {
      alertType: "5_days",
      state: { ...state, notified15: true, notified5: true },
    };
  }
  if (days <= 15 && !state.notified15) {
    return { alertType: "15_days", state: { ...state, notified15: true } };
  }
  return null;
}
