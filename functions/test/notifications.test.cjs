const assert = require("node:assert/strict");
const test = require("node:test");

const {
  VEHICLE_NOTIFICATION_DEADLINES,
  customReminderPolicy,
  getAlertDecision,
  notificationDueDate,
} = require("../lib/notificationPolicy.js");

test("quarterly IFTA alerts use the filing due date, not quarter end", () => {
  const record = { dueDate: "2026-04-30", filingPeriodEnd: "2026-03-31" };
  assert.equal(notificationDueDate(record), "2026-04-30");
  assert.equal(getAlertDecision(15, record.dueDate, null, "ifta-quarterly"), null);
  assert.equal(getAlertDecision(5, record.dueDate, null, "ifta-quarterly").alertType, "5_days");
  assert.equal(getAlertDecision(0, record.dueDate, null, "ifta-quarterly").alertType, "due_today");
});

test("standard requirements alert at 15 days, 5 days, and due date", () => {
  assert.equal(getAlertDecision(15, "2026-12-31", null).alertType, "15_days");
  assert.equal(getAlertDecision(5, "2026-12-31", null).alertType, "5_days");
  assert.equal(getAlertDecision(0, "2026-12-31", null).alertType, "due_today");
});

test("custom requirement frequency selects the intended reminder schedule", () => {
  assert.equal(customReminderPolicy({ scheduleType: "fixed" }), "standard");
  assert.equal(customReminderPolicy({ scheduleType: "rolling", recurrenceKind: "calendar-monthly" }), "five-day-and-due");
  assert.equal(customReminderPolicy({ scheduleType: "rolling", recurrenceKind: "calendar-quarterly" }), "five-day-and-due");
  assert.equal(customReminderPolicy({ scheduleType: "rolling", intervalValue: 1, intervalUnit: "week" }), "due-day-only");
  assert.equal(customReminderPolicy({ scheduleType: "rolling", intervalValue: 3, intervalUnit: "month" }), "five-day-and-due");
  assert.equal(customReminderPolicy({ scheduleType: "rolling", intervalValue: 1, intervalUnit: "year" }), "standard");
});

test("a changed due date starts a new reminder occurrence", () => {
  const oldState = {
    dueDate: "2026-04-30",
    notified30: false,
    notified15: true,
    notified5: true,
    notifiedDue: true,
  };
  assert.equal(getAlertDecision(5, "2026-07-31", oldState, "ifta-quarterly").alertType, "5_days");
});

test("fleet notification inventory matches every fleet deadline field", () => {
  assert.deepEqual(
    VEHICLE_NOTIFICATION_DEADLINES.map(item => item.field).sort(),
    ["inspectionExpiration", "registrationExpiration"]
  );
});
