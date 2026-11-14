# Owner and customer compliance parity audit

## Shared behavior now in staging

| Behavior | Customer view | Owner view | Result |
| --- | --- | --- | --- |
| Calendar day and countdown | Shared Pacific calendar and day difference | Same shared functions | Aligned, including daylight saving boundaries |
| Annual and rolling date arithmetic | Shared day/year addition | Same shared functions | Aligned for MVR, Clearinghouse and Portal dates |
| Company dates with no stored value | Shared MCS-150, annual calendar and quarterly IFTA defaults | Same shared functions | Aligned |
| Entering a date | `MM-DD-YYYY` with real-date validation | Same format and validator | Aligned; owner additionally records the verification source |
| Saving a date | Updates the carrier's compliance, driver, vehicle or custom requirement document | Updates that same document using a guarded transaction | Both views read the same saved value |
| Completion history | Reads the requirement's completion-history collection | Reads the same collection, without a display cap | Aligned for managed Company, Driver and Fleet items that have history |
| Deleting completion history | Older entries do not rewind the current date; latest entry restores only if its result is still current | Same guarded rollback conditions through an owner-only function | Latest-entry deletion restored the earlier status on DEMO 01; older-entry behavior still needs a separate staging test |
| Form 2290, UCR, IFTA license, quarterly IFTA, and BOC-3 completion | Marks the carrier requirement complete and writes shared completion history | Owner can confirm completion with a date and verification note; writes the same carrier document and history path | DEMO 01 BOC-3 completion saved and appeared in history |
| Company applicability | Customer can mark a built-in item not applicable and reverse the choice | Owner can do the same; item remains visible in All active and leaves urgent counts | Demo BOC-3 was observed as not applicable, then successfully returned to active tracking |
| Driver qualification file | Eight document and qualification checks on the driver record | Owner can update those same eight fields with a source note; all eight must be confirmed for the owner checklist to read complete | DEMO 02 first check saved, then reverted; blank source was rejected |

## Deliberate workflow differences

- The owner queue groups work into overdue, 30-day and 31–90-day lists. The customer's requirement badge can also use requirement-specific attention windows. The numerical day count is shared.
- The owner's 31–90-day total uses the same non-overlapping 31–90-day range as its company list.
- The owner must name the source of a verified date. The customer can edit their own date without a source note.
- Customers and owners can confirm the five listed Company filing/status items. The owner must record the confirming source. Other renewals and Driver/Fleet dates still follow their existing date and work-log flows; this change does not grant the owner blanket authority to mark every item complete.
- DQ checks represent document or qualification status. They do not upload the underlying file or certify that all documents have been reviewed. Owner changes are logged in the action history; the customer checklist has no separate completion-history collection.
- Owner access is limited to active managed areas and enrolled units. Customers retain access to their own records, including self-managed items.

## Verification

- Application TypeScript check and Firebase Functions build pass.
- Shared calendar tests pass for Pacific midnight, daylight saving, leap day, invalid dates, USDOT and IFTA defaults.
- Staging web export succeeds. The staging owner screen loads and displays the shared date format and completion-history section.
- Staging functions and the preview hosting channel were deployed; production was not changed.
- The live staging owner page shows the completion date and applicability controls. A staging demo work-log action saved successfully and appeared in action history with a visible success message.
- On November 13 the staging browser stalled during a demo applicability reversal. The outcome was not observable, so it is not counted as a passed test.
- A fresh owner-page read later confirmed that reversal: DEMO 01 BOC-3 returned to active tracking and its action history recorded the change.
- The owner marked DEMO 01 BOC-3 complete using a synthetic staging note. A fresh read showed Completed, one completion-history record, and a saved action. Customer sign-in for that demo carrier is unavailable, so customer-screen parity remains unverified.
- On DEMO 02, an invalid truck inspection date was rejected without changing the stored date. A valid date changed its countdown and queue status; restoring the original date worked. A Driver CDL date also saved, changed its displayed date, and restored correctly.
- A DQ checklist update without a source note was rejected. With a synthetic source note, the first check moved from 0/8 to 1/8, then returned to 0/8 with another logged update.
- The browser stalled on the native deletion confirmation, but a fresh read confirmed the deletion succeeded: DEMO 01 BOC-3 returned to Needs information, the completion record disappeared, and action history logged the deletion. The owner page now uses an on-page two-step confirmation.
- On November 13, the sign-in-capable staging account `bag@bag.com` showed BOC-3 complete and Driver DQ 0/8 in both views. Its Driver CDL expiration showed August 30, 2030 and 1,386 days in both views. The owner temporarily changed that date to September 1, 2030 with a staging-only note; the customer dashboard then showed September 1 and 1,388 days. The owner restored August 30, and the customer confirmed that original date after refreshing. Fleet was not included in this account's managed coverage.
- During the later history-control check, an owner tab still running the older script opened a native browser confirmation. Dismissing that prompt through computer control did not prevent the old script from deleting `bag@bag.com`'s BOC-3 completion. The prior status was restored by recording a new completion dated November 13 with a note that explicitly identifies the staging restoration; the original history record itself could not be recovered. The customer confirmed BOC-3 showed Completed again. After reloading the newer page, Delete displayed the intended on-page confirmation. Keep record closed it, and the owner view still showed Completed with one history record. A server-side confirmation value now rejects deletion requests from stale tabs; the updated function and preview page were deployed to staging on November 13.
- The customer opened BOC-3 History (1) on November 13 and saw the restored completion dated November 13, completed by the owner account, with the explicit staging-restoration note. Customer completion-history display is verified for this one-time Company item.
- On November 13 a new, explicitly disposable DEMO 01 BOC-3 completion was saved. An owner tab left open before the server update attempted to delete it, and the server rejected that request with “Refresh owner tools before deleting completion history”; the record remained. After a page refresh, the on-page Confirm delete removed the demo record, returned BOC-3 to Needs information with its previous due date, and logged the deletion. The latest-record deletion path and stale-tab protection are verified. An older-record deletion remains untested.
- On November 13 a new staging account `the@the.com` saved a synthetic truck registration expiration of February 15, 2027. Its customer Fleet card showed that date and 94 days remaining. A Fleet-only managed request recognized the one truck already on its dashboard, and the owner quote counted it once. After the user completed Stripe Sandbox checkout, the owner started Fleet-only coverage. The owner work list and customer Fleet card both showed `QA-FLEET-1113` due February 15 with 94 days remaining. The owner temporarily set February 16 with a labeled test note; the customer dashboard logged the February 16 update. The owner restored February 15; the customer dashboard logged that update and the Fleet card again showed February 15 with 94 days remaining. The owner work list also showed the restored date and countdown. This verifies the shared Fleet date and countdown path for an active managed truck.

## Before production

Use a disposable staging record to check an older history entry before treating older-entry deletion as proven. Do not use a real customer's compliance record for this test.
