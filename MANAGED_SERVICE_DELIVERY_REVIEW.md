# Managed support delivery review — staging, October 30, 2026

## Price and time budget

These are gross revenue budgets at a target of $50 per hour of direct work. They do not include Stripe fees, taxes, software costs, unsold time, or customer support outside the defined scope.

| Service | Price | Time available at $50/hour | Operating assumption |
| --- | ---: | ---: | --- |
| Company monitoring | $29/month after year one | 34.8 minutes/month | Batch deadline reviews and templated instructions; customer completes filings and payments. |
| First-year Company setup portion | $96 in first year ($8/month) | 1 hour 55 minutes once | Verify applicability, enter or validate dates, explain the workflow. |
| Driver monitoring | $13/month per active driver | 15.6 minutes/month per driver | Routine review and occasional templated follow-up. |
| Truck or trailer monitoring | $1/month per active unit | 14.4 minutes/year per unit | Two dates at most; alerts and contact must be batched by carrier. |
| Fleet-only onboarding | $40 once per Fleet-only account | 48 minutes once | Verify current registration and inspection dates before starting. |
| DQ file preparation | $99 once per requested file | 1 hour 59 minutes per file | Charge separately only when the work is accepted. |

Company management costs $37/month for its first 12 months, then $29/month. The first-year difference is $96, replacing the earlier approximate $99 setup figure so every monthly charge is a whole dollar.

At these rates, a Company + one Driver + one Truck + one Trailer account yields $52/month in the first year and $44/month afterward for managed support, plus the existing $3/month app subscription. The managed first-year total is $624. Its $50/hour direct-work budget is 12.48 hours for the year: 1.92 hours of Company setup, 6.96 hours of ongoing Company work, 3.12 hours for the Driver, and 0.48 hours for two vehicles. A DQ file adds $99 and up to 1.98 hours of direct work.

## Operating limits

- Fleet-only keeps the $1/month per active unit but adds $40 once for onboarding. At $50/hour this buys 48 minutes to review current registrations and inspections. Charge it only when neither Company nor Driver management is selected.
- A vehicle's $12/year supports 14.4 minutes of work at $50/hour. One unexpected phone call can consume the annual allowance. Batch vehicle alerts with the Company's other work.
- Company work over 35 minutes/month or first-year setup over two hours reduces the realized labor rate below $50/hour. State-specific and custom filings must be reviewed before acceptance, with nonstandard work quoted separately.
- The $99 DQ-file fee supports less than two hours. If records are missing or previous-employer follow-up is extensive, quote that work separately before accepting the file.
- Track actual time for the first 10 carriers, including reading records, calls, email, corrections, and follow-ups. Review gross revenue per direct hour before expanding volume.
- The Company budget is just under seven hours per year of ongoing work. Ten company requirements, including quarterly items, can exceed that if follow-ups are personal. This rate needs a tightly defined monitoring and instruction scope; manual filing or research belongs in a separate quote.
- Driver monitoring buys about 3.1 hours per year per driver. A $99 DQ file buys less than two hours. Measure the first few cases before presenting that fee as a complete file build in every circumstance.

For a one-Company, one-Driver, one-Truck, one-Trailer pilot, the first-year $624 managed revenue supports 12.48 hours of direct work at $50/hour. A plausible working budget is Company setup 2 hours, recurring Company review and follow-up 5–7 hours, Driver 1.5–3 hours, and the two vehicles together 0.5–1 hour. That range is 9–13 hours before unusual state research, repeated calls, or document chasing. The upper end is already above the target budget. Log the actual time and reprice or narrow the scope if it approaches 12 hours.

## Proposed customer and owner sequence

1. Customer has active app access and requests selected managed areas on the web. Show unit prices, first-year Company rate, later Company rate, and separate DQ-file fee before submission. Collect contact details and text permission.
2. Owner verifies the carrier's active drivers, trucks, trailers, applicable items, and missing dates. Owner accepts the scope and records the planned start date and any DQ files requested.
3. Customer sees a locked quote with the first invoice, monthly recurring amount, first-year Company change, app subscription amount separately, and clear division of duties. The customer explicitly accepts the scope.
4. Only then does the web app open managed-service Stripe Checkout for the approved quote. Stripe's server events, rather than the browser return URL, confirm payment.
5. Once payment is confirmed, owner starts coverage. The customer dashboard and owner queue share the same selected areas and dates. If payment fails, expires, or is canceled, no new coverage starts.
6. Existing app subscription and managed-service subscription must be classified separately in all Stripe handlers so one cannot overwrite the other's access, customer record, or referral accounting.

## Implementation checkpoint

The isolated staging preview now has a quote, customer acceptance, separate managed Stripe Checkout, signed-webhook payment confirmation, an activation gate, a separate managed subscription marker, and a Stripe schedule intended to reduce Company from $37 to $29 after month 12. The customer and owner screens reflect those steps. The Firebase staging project and preview channel were updated on October 31; production remains unchanged. The staging Stripe key is in test mode and its webhook endpoint is enabled. A Company-only staging request and $37/$29 quote were verified on both screens. No test payment or activation has been run.

The customer now deliberately chooses “Ask us to manage,” which starts with Company, Driver, and Fleet selected. Each area can be removed before submitting. The next screen collects driver names, CDL identity and known expiration dates, and truck/trailer unit numbers, VINs, and known expiration dates. Empty Driver or Fleet lists are permitted and add $0 to the managed quote; a $0 total cannot proceed to checkout. The owner sees the intake and can explicitly enter listed units as active before quoting. The customer is told that each new active driver also adds $1/month to the separate app subscription. The owner action is repeat-safe against existing CDL/VIN identities and records an event. This is a staging workflow, not a completed live-service billing policy for units added after activation.

Before live rollout, run a Stripe test-mode checkout end to end, including a year-two schedule inspection; confirm cancellation at period end; confirm app billing and referral accounting stay unchanged; test payment failure and duplicate webhook events. New drivers and vehicles are now flagged in the owner queue and excluded from managed work until a revised quote. Changes to an active managed scope, quantity decreases, and the corresponding repricing and consent workflow still need implementation. Until that exists, do not promise that adding or removing a unit automatically changes the managed charge or coverage.
