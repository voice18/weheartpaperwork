const test = require("node:test");
const assert = require("node:assert/strict");
const { validComplianceDate, complianceAddDays, complianceAddYears, complianceDaysFrom, complianceToday, complianceUsdotDue, complianceNextIftaQuarterDue, complianceFollowingIftaQuarterDue, complianceIftaQuarterEnd, complianceFixedCalendarDue } =
  require("../lib/sharedComplianceDates.js");

test("both views use the Pacific calendar day across midnight", () => {
  const now = new Date("2026-11-13T07:30:00Z");
  assert.equal(complianceToday(now), "2026-11-12");
  assert.equal(complianceDaysFrom("2026-11-13", complianceToday(now)), 1);
});

test("calendar arithmetic stays stable across daylight saving and leap years", () => {
  assert.equal(complianceDaysFrom("2026-03-09", "2026-03-07"), 2);
  assert.equal(complianceAddDays("2026-03-07", 2), "2026-03-09");
  assert.equal(complianceAddYears("2024-02-29", 1), "2025-02-28");
  assert.equal(complianceAddDays("2024-02-29", 365), "2025-02-28");
});

test("invalid entered dates cannot become deadlines", () => {
  assert.equal(validComplianceDate("2026-02-29"), null);
  assert.equal(complianceDaysFrom("2026-02-29"), null);
  assert.equal(complianceAddYears("2026-02-29", 1), "");
});

test("company default dates come from the same calendar rules", () => {
  assert.equal(complianceUsdotDue("1234551", "2026-11-12"), "2027-01-31");
  assert.equal(complianceUsdotDue("1234560", "2026-11-12"), "2026-10-31");
  assert.equal(complianceNextIftaQuarterDue("2026-11-12"), "2027-01-31");
  assert.equal(complianceFixedCalendarDue("tax2290", "2026-11-12"), "2026-08-31");
  assert.equal(complianceFixedCalendarDue("ifta", "2026-11-12"), "2026-12-31");
  assert.equal(complianceIftaQuarterEnd("2027-01-31"), "2026-12-31");
  assert.equal(complianceFollowingIftaQuarterDue("2027-01-31"), "2027-04-30");
});
