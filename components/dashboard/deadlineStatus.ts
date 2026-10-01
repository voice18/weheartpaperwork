import { daysFrom } from "../../lib/requirements";

/** Presentation only. Notification windows and due-date calculations stay in their existing logic. */
export function deadlineStatus(date: string | null | undefined) {
  const days = daysFrom(date || null);
  if (days === null) return { text: "Needs date", color: "#A32D2D", bg: "#FCEBEB" };
  if (days < 0) return { text: `${Math.abs(days)} overdue`, color: "#A32D2D", bg: "#FCEBEB" };
  if (days === 0) return { text: "Due today", color: "#854F0B", bg: "#FAEEDA" };
  if (days <= 30) return { text: `${days} days`, color: "#854F0B", bg: "#FAEEDA" };
  if (days <= 90) return { text: `${days} days`, color: "#185FA5", bg: "#E6F1FB" };
  return { text: `${days} days`, color: "#3B6D11", bg: "#EAF3DE" };
}
