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
| Deleting completion history | Older entries do not rewind the current date; latest entry restores only if its result is still current | Same guarded rollback conditions through an owner-only function | Implemented; end-to-end deletion still needs a disposable staging record |
| Form 2290, UCR, IFTA license, quarterly IFTA, and BOC-3 completion | Marks the carrier requirement complete and writes shared completion history | Owner can confirm completion with a date and verification note; writes the same carrier document and history path | Controls visible in staging; saving a disposable completion still needs a click-through |
| Company applicability | Customer can mark a built-in item not applicable and reverse the choice | Owner can do the same; item remains visible in All active and leaves urgent counts | Demo BOC-3 was observed as not applicable and excluded from urgent counts; reversal is not yet verified |
| Driver qualification file | Eight document and qualification checks on the driver record | Owner can update those same eight fields with a source note; all eight must be confirmed for the owner checklist to read complete | Implemented in staging; click-through still needed |

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

## Before production

Use a disposable staging completion record to verify a completed requirement appears in both views, deletion of an older entry leaves the current deadline unchanged, and deletion of the newest entry restores the previous deadline in both views. Also check one Company, one Driver and one Fleet requirement with an actual saved date. Do not use a real customer's compliance record for this test.
