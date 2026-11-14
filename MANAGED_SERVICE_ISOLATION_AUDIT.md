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
- On November 13, a fresh staging account `the@the.com` selected the self-managed path, completed Stripe Sandbox trial checkout, opened its dashboard, and showed a 14-day Free trial in Settings ending November 27. A synthetic truck `QA-FLEET-1113` saved a February 15, 2027 registration expiration and showed 94 days remaining on the customer Fleet screen.
- The same staging account requested Fleet-only support. The intake recognized its existing truck without a duplicate entry. The owner queue prepared an exact quote for one truck: $1/month managed support and $40 one-time onboarding, with Company and Driver self-managed and the $2/month app subscription separate. The user accepted and paid the quote in Stripe Sandbox. The customer page showed Payment received; the owner queue showed paid awaiting start. The owner saved a Fleet-only setup draft, then started coverage. The customer dashboard showed Company and Driver self-managed and Fleet managed, with the same one-truck roster and registration deadline. The owner temporarily changed the truck's registration date by one day, and the customer dashboard logged the change. The original February 15 date was restored, and both views showed 94 days remaining.
- The owner-side controls have been exercised on disposable staging records. On `bag@bag.com`, the customer and owner views matched BOC-3 completion, Driver DQ 0/8, and the CDL date/countdown. An owner CDL-date change appeared on the customer dashboard and the original date was restored in both views. A stale owner tab's native confirmation unexpectedly deleted the test BOC-3 completion; its completed status was restored with a labeled new history record, and the customer confirmed Completed. On the refreshed page, the new on-page Delete → Keep record flow preserved that record. The updated staging function now requires a server-side confirmation value to reject stale-page deletions, and the matching preview site is deployed. The customer opened BOC-3 History (1) and saw the restored record and note. A later disposable DEMO 01 BOC-3 completion was deleted through the refreshed on-page Confirm delete control; the previous date returned and an action was logged. A managed Fleet change on a sign-in-capable account and older-history deletion still need click-through checks.

## Production gate

1. Server-enforced managed-service release switch is implemented, default off in production. It blocks new requests, quotes, acceptance, and managed checkout for accounts outside the pilot. Existing paid coverage can still be fulfilled, and cancellation remains available. Ordinary app checkout remains available. Production deployment and a pilot allowlist are still pending.
2. Finish any remaining disposable staging cases before inviting a pilot: an older completion-history entry, Form 2290 and IFTA completion, all eight DQ checks, and the reminder path. The latest-history undo, BOC-3 applicability, Driver date, Fleet date, and owner/customer synchronization checks have passed.
3. The fresh self-managed signup, Sandbox trial checkout, dashboard access, and Fleet date save passed. Check existing subscriber sign-in, cancellation and restart, and iOS and Android behavior against their published builds before release.
4. Deploy behind the off switch, then smoke-test the self-managed journey in production before inviting the pilot. Do not activate a managed charge until the pilot quote and scope are accepted.
5. Watch the pilot's Stripe invoice, app access, owner queue, customer dashboard, owner alerts, and cancellation. Expand access only after the pilot passes.

## Rollback

- Turn off new managed requests and checkout through the release switch; leave app-only checkout and access available.
- Roll back the web UI and affected functions to the last known good release if a shared route or billing regression appears. Check Stripe and Firestore status before rolling back a billing webhook.
- Do not delete shared carrier compliance records. If a pilot is already paying for managed work, resolve that subscription and communicate with the customer before stopping service.

Passing automated tests does not establish zero risk. The feature switch, staging click-through, and self-managed regression checks are required before production.
