# Managed support release isolation audit — 2026-11-13

## Finding

The managed service is staged separately, but it is not fully independent of the existing app. Production should not receive this branch as one unrestricted release.

| Boundary | Current arrangement | Release risk |
| --- | --- | --- |
| Staging environment | Separate Firebase project, preview hosting channel, and Stripe Sandbox | Staging testing does not change production |
| Managed records | Separate requests, quotes, coverage, billing, work, and activity collections | Managed state can be disabled without deleting the carrier's compliance records |
| Compliance records | Owner and customer views intentionally read and write the same carrier compliance, driver, and vehicle documents | A bad owner update would affect the customer's existing dashboard and countdown |
| Checkout and webhook | Existing app checkout and subscription sync contain conditional combined-plan logic | A regression here could affect self-managed billing and access |
| Routes and Settings | Managed choices, status, and owner navigation are integrated into the same app | A route or access-gate regression could affect existing customers |
| Firestore rules | Managed collection rules and protected enrolled-unit deletion checks are in the shared ruleset | A rules regression could affect existing reads or edits |

## Evidence available now

- The branch is `managed-service-staging-20261030`; managed support has not been released to production.
- Staging owner controls and three new functions were deployed to `weheartpaperwork-staging` only.
- Staging owner tests saved and restored Company applicability and BOC-3 completion, a Driver CDL date and DQ checklist status, and a Fleet inspection date. Invalid dates and a blank DQ verification source were rejected. Deleting the latest BOC-3 completion restored its earlier status.
- All 73 Firebase Functions tests pass. The app TypeScript check and mobile configuration validation pass.
- The owner-side controls have been exercised on disposable staging records. A sign-in-capable test carrier is still needed to confirm that the customer sees the same saved dates, countdowns, and history. The new on-page history deletion confirmation and older-history deletion still need click-through checks.

## Production gate

1. Server-enforced managed-service release switch is implemented, default off in production. It blocks new requests, quotes, acceptance, and managed checkout for accounts outside the pilot. Existing paid coverage can still be fulfilled, and cancellation remains available. Ordinary app checkout remains available. Production deployment and a pilot allowlist are still pending.
2. Test a disposable staging carrier: Form 2290 and BOC-3 completion; IFTA renewal; not-applicable and re-enable; all eight DQ checks; an action with and without a note. Verify both views, countdowns, history, and undo.
3. Test the unchanged self-managed journey on staging: existing subscriber sign-in, new app-only signup and checkout, dashboard dates, reminder access, cancellation, and restart. Check iOS and Android against their existing published app behavior.
4. Deploy behind the off switch, then smoke-test the self-managed journey in production before inviting the pilot. Do not activate a managed charge until the pilot quote and scope are accepted.
5. Watch the pilot's Stripe invoice, app access, owner queue, customer dashboard, owner alerts, and cancellation. Expand access only after the pilot passes.

## Rollback

- Turn off new managed requests and checkout through the release switch; leave app-only checkout and access available.
- Roll back the web UI and affected functions to the last known good release if a shared route or billing regression appears. Check Stripe and Firestore status before rolling back a billing webhook.
- Do not delete shared carrier compliance records. If a pilot is already paying for managed work, resolve that subscription and communicate with the customer before stopping service.

Passing automated tests does not establish zero risk. The feature switch, staging click-through, and self-managed regression checks are required before production.
