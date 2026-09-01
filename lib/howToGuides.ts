export type HowToStep = {
  title: string;
  text: string;
  bullets?: string[];
};

export type HowToGuide = {
  slug: string;
  category: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  intro: string;
  reviewed: string;
  time: string;
  cost: string;
  gather: string[];
  steps: HowToStep[];
  keep: string[];
  caution: string;
  primaryAction?: { label: string; url: string };
  alternateActions?: Array<{ label: string; url: string; note?: string }>;
  generator?: { title: string; description: string; status: "planned" | "available" };
  relatedComplianceSlug: string;
  sources: Array<{ label: string; url: string }>;
};

export const howToGuides: HowToGuide[] = [
  {
    slug: "file-ucr-registration",
    category: "FEDERAL REGISTRATION",
    title: "How to file your UCR registration",
    metaTitle: "How to File UCR Registration | Step-by-Step",
    metaDescription: "Gather what you need, use the official UCR portal, complete the annual registration, and save proof for your compliance records.",
    intro: "UCR is one of the easier filings once you know where the real portal is. This walks you from your USDOT number to saved proof of registration.",
    reviewed: "August 21, 2026",
    time: "Usually 10–15 minutes",
    cost: "Government fee based on fleet bracket",
    gather: ["USDOT number", "Legal business name and contact information", "Fleet count used for the applicable UCR bracket", "Payment method"],
    steps: [
      { title: "Start at the official UCR system", text: "Use the UCR Plan's registration link. Avoid renewal solicitations that look governmental but lead to a private filing service." },
      { title: "Look up your company", text: "Enter the USDOT number and confirm the legal name and company details before continuing." },
      { title: "Confirm the registration year and fleet bracket", text: "Choose the year you are filing and verify the vehicle count used to calculate the fee. Fees are set by bracket and can change by registration year." },
      { title: "Certify, pay, and save the receipt", text: "Review the filing before certifying it. Download or print the confirmation and receipt after payment." },
      { title: "Put the next cycle on the calendar", text: "UCR is annual. Record the completed date and next registration cycle in We Heart Paperwork instead of relying on another solicitation to remind you." }
    ],
    keep: ["Registration confirmation", "Payment receipt", "Registration year and fleet bracket used"],
    caution: "UCR is separate from USDOT registration, operating authority, IRP, and IFTA. Completing one does not complete the others.",
    primaryAction: { label: "Open the official UCR registration system", url: "https://www.ucr.gov/" },
    relatedComplianceSlug: "ucr-registration",
    sources: [{ label: "UCR Plan — Registration and fee information", url: "https://plan.ucr.gov/fee-brackets/" }]
  },
  {
    slug: "file-form-2290",
    category: "FEDERAL TAX FILING",
    title: "How to file Form 2290 and get your Schedule 1",
    metaTitle: "How to File Form 2290 and Get Schedule 1",
    metaDescription: "Prepare your EIN, VIN and taxable gross weight, file Form 2290, pay HVUT, and save the watermarked Schedule 1.",
    intro: "The IRS does not accept a Form 2290 e-file directly on IRS.gov. You choose an approved commercial provider, complete the return, pay any tax due, and keep the watermarked Schedule 1.",
    reviewed: "August 21, 2026",
    time: "Often 10–20 minutes when your information is ready",
    cost: "Tax due plus the provider's separate filing fee",
    gather: ["EIN—not a Social Security number", "Business name exactly as assigned to the EIN", "VIN for each vehicle", "Taxable gross weight", "First-use month", "Payment method"],
    steps: [
      { title: "Confirm that Form 2290 applies", text: "The filing generally applies to a highway motor vehicle with a taxable gross weight of 55,000 pounds or more that is registered, or required to be registered, in your name." },
      { title: "Choose a current IRS-approved e-file provider", text: "The IRS publishes a provider list for each tax year. Compare the provider fee and make sure the service supports your filing situation." },
      { title: "Enter the business and vehicle information", text: "Use the EIN name exactly. Enter every VIN carefully and choose the correct taxable gross-weight category and first-use month." },
      { title: "Review the tax and choose how to pay", text: "The provider fee and the federal tax are separate. The IRS lists electronic funds withdrawal, EFTPS, and card payment options." },
      { title: "Download the watermarked Schedule 1", text: "Do not stop at a payment screen. Save the IRS-accepted, watermarked Schedule 1; that is the proof commonly needed for vehicle registration." },
      { title: "Record the filing in We Heart Paperwork", text: "Save the filing date and next period so the easy filing does not become a hard deadline next year." }
    ],
    keep: ["Filed Form 2290", "Watermarked Schedule 1", "Payment confirmation", "Provider receipt"],
    caution: "The normal annual cycle does not cover every situation. A newly purchased vehicle, increased taxable weight, mileage-limit change, VIN correction, sale, or destroyed vehicle can require a different filing or credit process.",
    primaryAction: { label: "File with SimpleForm2290", url: "https://www.simpleform2290.com/" },
    alternateActions: [
      { label: "Compare IRS-approved e-file providers", url: "https://www.irs.gov/e-file-providers/tax-year-2026-form-2290-modernized-e-file-mef-providers", note: "SimpleForm2290 is the service Aaron uses. It appears on the IRS provider list. We Heart Paperwork receives no payment for this link." }
    ],
    relatedComplianceSlug: "form-2290-hvut",
    sources: [
      { label: "IRS — E-file Form 2290", url: "https://www.irs.gov/e-file-providers/e-file-form-2290" },
      { label: "IRS — Form 2290 instructions (July 2026)", url: "https://www.irs.gov/instructions/i2290" }
    ]
  },
  {
    slug: "get-driver-mvr",
    category: "DRIVER RECORD",
    title: "How to get a driver’s motor vehicle record",
    metaTitle: "How to Get a Driver MVR for a DOT Driver File",
    metaDescription: "Find the official state motor vehicle agency, request the right driver record, document consent where required, and file the MVR review.",
    intro: "There is no single federal MVR website. The record comes from the state licensing agency, and the request process, fee, consent rules, and record name vary by state.",
    reviewed: "August 21, 2026",
    time: "Online delivery may be immediate; account, mail, or authorization steps can add time",
    cost: "The state or authorized source sets the record fee—check it before ordering",
    gather: ["Driver's full legal name", "Driver's license number and issuing state", "Date of birth or other state-required identifiers", "Employer authorization or driver consent required by the state", "Company payment method"],
    steps: [
      { title: "Start with the issuing state", text: "Use the state shown on the driver's current license. USA.gov maintains an official state motor vehicle service directory that leads to the correct state agency." },
      { title: "Choose an employer or certified driving record", text: "Do not assume every product called a driving record contains the same history. Select the record appropriate for an employer's driver-qualification inquiry." },
      { title: "Follow the state's identity and consent process", text: "Some states allow an immediate online employer request; others require an account, authorization form, mail request, or approved record vendor." },
      { title: "Save the record and document the review", text: "The MVR itself and the carrier's annual review are related but distinct records. File both when the annual review is due." },
      { title: "Track the next annual review", text: "Record the completion date in We Heart Paperwork so the next review runs from what you actually completed." }
    ],
    keep: ["The MVR received from the state or authorized source", "Request receipt or confirmation", "Annual review documentation", "Any required driver authorization"],
    caution: "A consumer copy, unofficial lookup, or screenshot may not satisfy the employer inquiry you need. Confirm the record type with the issuing state and the applicable federal rule.",
    primaryAction: { label: "Find your official state motor vehicle agency", url: "https://www.usa.gov/state-motor-vehicle-services" },
    generator: { title: "MVR request and annual-review packet", description: "Planned document engine: collect the carrier and driver details once, then produce the request/authorization and annual-review paperwork that applies to the selected workflow.", status: "planned" },
    relatedComplianceSlug: "annual-mvr",
    sources: [
      { label: "USA.gov — State motor vehicle services", url: "https://www.usa.gov/state-motor-vehicle-services" },
      { label: "FMCSA — Driver Qualification File Checklist", url: "https://csa.fmcsa.dot.gov/SafetyPlanner/GetFile.aspx?d=44" }
    ]
  },
  {
    slug: "build-driver-qualification-file",
    category: "DOCUMENT WORKFLOW",
    title: "How to build a driver qualification file",
    metaTitle: "How to Build a DOT Driver Qualification File",
    metaDescription: "Build a driver qualification file in a deliberate order, separate hiring documents from recurring reviews, and track what must be renewed.",
    intro: "A DQ file is not one form. It is a group of records collected at different points—before driving, during onboarding, and on a recurring schedule after hire.",
    reviewed: "August 21, 2026",
    time: "Start before the driver operates; outside records and responses can take several days",
    cost: "The builder is free; State records, testing, and examinations may have separate charges",
    gather: ["Driver application and prior-employer information", "License and identity details", "State driving records", "Medical qualification information when applicable", "Road-test or equivalent certificate", "Drug and alcohol program records when applicable"],
    steps: [
      { title: "Create one file for one driver", text: "Use a consistent driver name and hire date. Keep sensitive drug and alcohol records in the location and access structure required for those records rather than casually mixing everything into one open folder." },
      { title: "Complete the pre-driving checks", text: "Collect the application, license information, required state MVR inquiries, prior-employer safety-performance history, medical qualification evidence, and road-test documentation or accepted equivalent that applies." },
      { title: "Record the onboarding confirmations", text: "Document the Clearinghouse pre-employment query and drug-testing steps that apply before the driver performs safety-sensitive work." },
      { title: "Separate permanent records from recurring work", text: "Some records stay with the file; others renew or repeat. Put medical expiration, annual MVR review, Clearinghouse annual query, license expiration, and any shorter qualification date on a tracked schedule." },
      { title: "Review the file as a file", text: "Use the FMCSA checklist to check completeness. A stack of documents is not useful if no one can tell what is missing or when it must be refreshed." }
    ],
    keep: ["Driver-specific DQ file checklist", "Documents supporting each applicable checklist item", "Completion and review dates", "A separate list of recurring dates entered into We Heart Paperwork"],
    caution: "Not every document belongs in the same unrestricted folder, and not every driver or operation has identical requirements. Use the official checklist and applicable regulations as the source of truth.",
    primaryAction: { label: "Build a DQ file starter packet", url: "https://weheartpaperwork.com/tools/driver-qualification-file/" },
    generator: { title: "DQ file starter packet", description: "Enter the carrier and driver details once to create carrier-authored forms, a file index, and an action plan. The packet identifies the official records you must still obtain and keeps restricted records separated.", status: "available" },
    relatedComplianceSlug: "driver-qualification-file",
    sources: [
      { label: "FMCSA — Driver Qualification File Checklist", url: "https://csa.fmcsa.dot.gov/SafetyPlanner/GetFile.aspx?d=44" },
      { label: "FMCSA Safety Planner — Driver qualification", url: "https://csa.fmcsa.dot.gov/safetyplanner/MyFiles/SubSections.aspx?ch=23&sec=66&sub=148" }
    ]
  },
  {
    slug: "update-mcs-150-motus",
    category: "FEDERAL REGISTRATION",
    title: "How to update your MCS-150 in Motus",
    metaTitle: "How to Update an MCS-150 in FMCSA Motus",
    metaDescription: "Prepare your company information, sign in through Login.gov, review your USDOT record, submit the MCS-150 update, and save confirmation.",
    intro: "The MCS-150 update itself is free. The important part is reviewing the whole USDOT record—not just changing one field—and keeping proof that FMCSA accepted the update.",
    reviewed: "August 21, 2026",
    time: "Usually 15–30 minutes when your records are ready",
    cost: "No FMCSA filing fee",
    gather: ["USDOT number", "Login.gov account", "Legal business and contact information", "Current power-unit and driver counts", "Mileage and mileage year", "Cargo and operation details"],
    steps: [
      { title: "Start from FMCSA's Registration Resources Hub", text: "Use the current FMCSA link to reach Motus. Old instructions that depend on a USDOT PIN are outdated." },
      { title: "Sign in and connect the company", text: "Use Login.gov and complete any identity or company-verification steps Motus requests." },
      { title: "Review the entire USDOT record", text: "Confirm the legal name, addresses, contact information, operation type, cargo, driver count, power units, and mileage—not only the item that brought you there." },
      { title: "Certify and submit", text: "Read the certification carefully, submit the update, and wait for the system's confirmation." },
      { title: "Save proof and track the next due date", text: "Keep the submission confirmation and record the new filing date in We Heart Paperwork. Your biennial filing month is still determined by the last two digits of the USDOT number." }
    ],
    keep: ["Submission confirmation", "Copy or screenshot of the updated record", "Date filed", "Name of the person who certified it"],
    caution: "An MCS-150 update does not renew operating authority, UCR, insurance, BOC-3, or state registrations. File sooner when company information changes; do not wait for the biennial cycle.",
    primaryAction: { label: "Find Motus through FMCSA", url: "https://www.fmcsa.dot.gov/registration/resources-hub" },
    relatedComplianceSlug: "mcs-150-biennial-update",
    sources: [
      { label: "FMCSA — Registration modernization FAQs", url: "https://www.fmcsa.dot.gov/registration/modernization-faqs" },
      { label: "FMCSA — Registration Resources Hub", url: "https://www.fmcsa.dot.gov/registration/resources-hub" }
    ]
  },
  {
    slug: "run-annual-clearinghouse-query",
    category: "DRIVER COMPLIANCE",
    title: "How to run an annual Clearinghouse query",
    metaTitle: "How to Run an Annual FMCSA Clearinghouse Query",
    metaDescription: "Get driver consent, purchase a query plan, run the annual limited query, handle a records-found result, and keep the required records.",
    intro: "Each covered driver needs a Clearinghouse query at least once within every rolling 365-day period. A limited query normally satisfies the annual requirement, but a records-found result requires a full query.",
    reviewed: "August 21, 2026",
    time: "Usually a few minutes per driver",
    cost: "FMCSA query-plan charge",
    gather: ["Employer Clearinghouse account", "Driver name and license details", "A current general consent for a limited query", "Query-plan balance", "Date of the last completed query"],
    steps: [
      { title: "Check the driver's last completed query", text: "Count 365 days from the actual completion date. Do not assume every driver's annual query is due January 1." },
      { title: "Obtain general consent", text: "Before a limited query, get the driver's signed consent outside the Clearinghouse. The consent may cover a stated period, but it must clearly describe the frequency." },
      { title: "Purchase a query plan if needed", text: "The employer purchases queries inside the Clearinghouse. A C/TPA can assist only when the proper designation and permissions are in place." },
      { title: "Run the limited query", text: "Select the correct driver, submit the query, and review the result rather than treating submission alone as completion." },
      { title: "Resolve a records-found result", text: "If the limited query says records were found, request a full query. The driver must provide electronic consent in the Clearinghouse before the full result is released." },
      { title: "Save the record and reset the clock", text: "Keep the consent and query result, then record the completed date in We Heart Paperwork." }
    ],
    keep: ["General consent for at least three years", "Query confirmation and result", "Full-query consent/result when required", "Completed date used for the next 365-day cycle"],
    caution: "A submitted query that is waiting for driver consent is not the same as a completed full query. A prohibited driver cannot perform safety-sensitive functions until the applicable return-to-duty requirements are satisfied.",
    primaryAction: { label: "Open the FMCSA Clearinghouse", url: "https://clearinghouse.fmcsa.dot.gov/" },
    relatedComplianceSlug: "clearinghouse-annual-query",
    sources: [
      { label: "FMCSA Clearinghouse — Employer Learning Center", url: "https://clearinghouse.fmcsa.dot.gov/Learn/Employer" },
      { label: "FMCSA Clearinghouse — Queries and consent FAQs", url: "https://clearinghouse.fmcsa.dot.gov/FAQ/Topics/Employers%2Cqueries-and-consent-requests" }
    ]
  },
  {
    slug: "renew-dot-medical-certification",
    category: "DRIVER COMPLIANCE",
    title: "How to renew DOT medical certification",
    metaTitle: "How to Renew a DOT Medical Certificate",
    metaDescription: "Find a certified medical examiner, prepare for the exam, confirm the certification reaches the state record, and track the actual expiration date.",
    intro: "A medical certificate can be issued for up to two years, but the examiner may issue a shorter period. Track the date printed on the result—not the date you expected to receive.",
    reviewed: "August 21, 2026",
    time: "The exam is often under an hour; appointment timing varies",
    cost: "The medical examiner sets the fee—confirm it when scheduling",
    gather: ["Driver's license", "Medication list", "Glasses, contacts, hearing aids, or exemption documents", "Relevant medical records", "Current medical certificate"],
    steps: [
      { title: "Find an examiner on the National Registry", text: "Confirm the examiner is currently listed by FMCSA before booking the examination." },
      { title: "Bring the records the examiner will need", text: "Medication, treatment, vision, hearing, or exemption documentation can prevent an avoidable delay when it applies to the driver." },
      { title: "Complete the examination", text: "The examiner determines whether the driver qualifies and for how long. Do not assume the result will always be a two-year certificate." },
      { title: "Confirm the electronic result", text: "Medical certification information is generally transmitted electronically to the state licensing agency. Check the driver's state CDL record and follow any state instructions." },
      { title: "Keep temporary proof when applicable", text: "Because FMCSA issued a temporary 2026 exemption during the electronic transition, a driver may need to carry the paper certificate for up to 60 days in an affected situation." },
      { title: "Track the actual expiration", text: "Enter the expiration shown for this driver in We Heart Paperwork and replace it if the examiner or state later changes the date." }
    ],
    keep: ["Medical examiner's certificate or temporary proof when provided", "Exam receipt", "Any variance or exemption documents", "Confirmation that the state record is correct"],
    caution: "The electronic reporting transition is time-sensitive and state implementation can differ. Check current FMCSA and state licensing guidance instead of relying on an old photocopy routine.",
    primaryAction: { label: "Search the National Registry", url: "https://nationalregistry.fmcsa.dot.gov/search-medical-examiners" },
    relatedComplianceSlug: "dot-medical-card",
    sources: [
      { label: "FMCSA National Registry — Driver fact sheet", url: "https://nationalregistry.fmcsa.dot.gov/assets/documents/nriilearningcenter/Driver%20Fact%20Sheet%202025.pdf" },
      { label: "FMCSA — 2026 temporary medical-certificate exemption", url: "https://www.fmcsa.dot.gov/regulations/federal-register-documents/2026-07173" }
    ]
  },
  {
    slug: "file-ifta-quarterly-return",
    category: "FUEL TAX",
    title: "How to file an IFTA quarterly return",
    metaTitle: "How to File an IFTA Quarterly Fuel Tax Return",
    metaDescription: "Reconcile jurisdiction miles and fuel, file through your base jurisdiction, report zero-operation quarters, pay the balance, and save the return.",
    intro: "IFTA is administered by your base jurisdiction, so the portal and form vary by state or province. The basic job is the same: report jurisdiction miles and qualified fuel for the quarter, even when the return is zero.",
    reviewed: "August 21, 2026",
    time: "Depends on the quality of your mileage and fuel records",
    cost: "Tax or credit calculated by the return; jurisdiction fees may apply",
    gather: ["Miles traveled by jurisdiction", "Total fleet miles", "Fuel gallons by jurisdiction", "Fuel receipts and bulk-fuel records", "Qualified vehicle list", "Prior-quarter adjustments"],
    steps: [
      { title: "Close and reconcile the quarter", text: "Match trip or electronic mileage records to fuel purchases and investigate missing states, gallons, or receipts before filing." },
      { title: "Open your base-jurisdiction IFTA portal", text: "File with the jurisdiction that issued your IFTA license. Do not choose a portal merely because the truck traveled there." },
      { title: "Report every required jurisdiction", text: "Enter taxable and total miles and tax-paid fuel as the return requests. File a zero return when required even if no qualified vehicle operated." },
      { title: "Review the calculation", text: "Check totals, fleet MPG, credits, prior adjustments, and unusual jurisdiction results before certifying." },
      { title: "Submit, pay, and save the complete return", text: "Keep the filed return and payment confirmation—not only a bank transaction or portal success screen." },
      { title: "Track the next quarter", text: "The usual due dates are April 30, July 31, October 31, and January 31, adjusted when the jurisdiction recognizes a weekend or holiday." }
    ],
    keep: ["Filed quarterly return", "Payment or credit confirmation", "Mileage source records", "Fuel receipts and summaries", "Adjustment support"],
    caution: "IFTA record format, retention, amendments, and portal steps come from your base jurisdiction. A zero-operation quarter generally does not eliminate the return requirement while the account remains active.",
    relatedComplianceSlug: "ifta-filing",
    sources: [{ label: "IFTA, Inc. — Official program website", url: "https://www.iftach.org/" }]
  },
  {
    slug: "renew-irp-registration",
    category: "VEHICLE REGISTRATION",
    title: "How to renew IRP apportioned registration",
    metaTitle: "How to Renew IRP Apportioned Registration",
    metaDescription: "Review your fleet, prepare distance and vehicle records, renew through the base jurisdiction, pay apportioned fees, and verify every cab card.",
    intro: "IRP renewal is handled by your base jurisdiction. Start early enough to correct a vehicle, distance, title, or insurance problem before the current cab cards expire.",
    reviewed: "August 21, 2026",
    time: "Use the renewal notice and begin early enough for your base jurisdiction to process changes",
    cost: "The base jurisdiction calculates apportioned fees from the application and fleet information",
    gather: ["Renewal notice or account login", "Fleet distance for the reporting period", "Current truck list and VINs", "Titles or ownership documents", "Insurance and tax proof required by the jurisdiction", "Form 2290 Schedule 1 when required"],
    steps: [
      { title: "Read the base-jurisdiction renewal instructions", text: "Confirm its deadline, distance period, document list, payment method, and whether credentials are mailed or available electronically." },
      { title: "Reconcile the fleet first", text: "Remove sold trucks, add new trucks through the correct transaction, and verify unit numbers, VINs, weights, ownership, and jurisdictions." },
      { title: "Prepare and check distance", text: "Use the required reporting period and reconcile IRP distance to the underlying trip or electronic records before entry." },
      { title: "Upload supporting documents", text: "Provide the title, lease, tax, insurance, residency, or other evidence your jurisdiction requests for the fleet and its vehicles." },
      { title: "Submit and pay", text: "Review the invoice and fleet details before payment. Resolve holds rather than assuming payment alone makes a vehicle legal." },
      { title: "Verify every credential", text: "Check each cab card against the correct truck and keep the renewal receipt and final fleet record." }
    ],
    keep: ["Renewal application", "Distance schedule", "Invoice and payment confirmation", "Final cab card for each truck", "Documents supporting additions and deletions"],
    caution: "IRP covers apportioned registration; it does not replace IFTA, UCR, operating authority, insurance, Form 2290, or annual inspection requirements.",
    primaryAction: { label: "Find your IRP jurisdiction", url: "https://www.irponline.org/search/custom.asp?id=373" },
    relatedComplianceSlug: "irp-apportioned-registration",
    sources: [{ label: "International Registration Plan — Official website", url: "https://www.irponline.org/" }]
  },
  {
    slug: "complete-annual-mvr-review",
    category: "DRIVER COMPLIANCE",
    title: "How to complete the annual MVR review",
    metaTitle: "How to Complete a DOT Annual MVR Review",
    metaDescription: "Obtain the driver's motor vehicle record, review it against qualification requirements, document the decision, retain both records, and set the next date.",
    intro: "Ordering the MVR is only half the task. The carrier must review the record, consider whether the driver remains qualified, and document that review at least once every 12 months.",
    reviewed: "August 21, 2026",
    time: "Usually 10–20 minutes after the MVR arrives",
    cost: "The State or authorized source sets the MVR fee—check it before ordering",
    gather: ["Current MVR from each required licensing state", "Driver's current license information", "Prior review date", "Carrier's review form or DQ-file checklist", "Information about any known violations or suspensions"],
    steps: [
      { title: "Obtain the proper MVR", text: "Request the employer-appropriate record from the issuing state or authorized source. Follow the state's consent and identity rules." },
      { title: "Review the whole record", text: "Look for suspensions, revocations, disqualifying offenses, restrictions, expiration, and patterns that affect whether the driver meets the applicable qualification rules." },
      { title: "Resolve anything unclear", text: "Do not simply initial a form when the record conflicts with the license, driver disclosure, or known event. Verify the driver's current status." },
      { title: "Document the carrier's decision", text: "Record who reviewed it, the review date, and whether the driver remains qualified. The review record is distinct from the MVR itself." },
      { title: "File both records and set the next date", text: "Keep the MVR and documented review in the DQ file, then record the completion date in We Heart Paperwork." }
    ],
    keep: ["MVR used for the review", "Signed or otherwise documented annual review", "Any supporting resolution records", "Next review date"],
    caution: "An annual review does not cure a suspended, revoked, expired, or otherwise disqualifying license. Address current qualification problems immediately.",
    primaryAction: { label: "Find your official state motor vehicle agency", url: "https://www.usa.gov/state-motor-vehicle-services" },
    relatedComplianceSlug: "annual-mvr",
    sources: [
      { label: "FMCSA — Driver Qualification File Checklist", url: "https://csa.fmcsa.dot.gov/SafetyPlanner/GetFile.aspx?d=44" },
      { label: "eCFR — 49 CFR 391.25", url: "https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-391/subpart-C/section-391.25" }
    ]
  },
  {
    slug: "complete-annual-dot-inspection",
    category: "VEHICLE COMPLIANCE",
    title: "How to complete an annual DOT inspection",
    metaTitle: "How to Complete an Annual DOT Vehicle Inspection",
    metaDescription: "Use a qualified inspector, inspect each truck and trailer, correct defects, keep the inspection report, and track the next 12-month deadline.",
    intro: "Every commercial motor vehicle in the operation—including a trailer that meets the rule—must be inspected at least once during the preceding 12 months. The report matters as much as the sticker.",
    reviewed: "August 21, 2026",
    time: "Ask the shop when scheduling; defects and repairs can extend the visit",
    cost: "Confirm the inspection charge with the shop; repairs are separate",
    gather: ["Truck or trailer identification and VIN", "Current inspection report", "Maintenance or defect information", "Qualified inspector", "Repair records for defects found"],
    steps: [
      { title: "List every vehicle due", text: "Treat trucks and trailers as separate equipment. Match each appointment to the correct unit and VIN." },
      { title: "Use a qualified inspector", text: "Confirm the person performing the periodic inspection meets the federal qualification requirements or the applicable approved state program." },
      { title: "Complete the inspection", text: "The inspection must cover the required components and produce a report identifying the vehicle, inspector, date, and results." },
      { title: "Correct defects and document repairs", text: "A sticker does not make an unsafe vehicle safe. Complete required repairs and retain evidence tying them to the inspection findings." },
      { title: "Keep the report with the right unit", text: "Retain the periodic inspection report for 14 months and ensure the vehicle carries or displays the required proof." },
      { title: "Reset the deadline from completion", text: "Enter the completed inspection date in We Heart Paperwork. The next date rolls from this inspection, unlike a fixed registration expiration." }
    ],
    keep: ["Periodic inspection report for at least 14 months", "Proof carried or displayed on the vehicle", "Repair documentation", "Inspector qualification evidence when the carrier employs the inspector"],
    caution: "A roadside inspection is not automatically the annual periodic inspection. It counts only when it meets the applicable periodic-inspection requirements.",
    primaryAction: { label: "Read FMCSA's Part 396 inspection guide", url: "https://www.fmcsa.dot.gov/sites/fmcsa.dot.gov/files/docs/fmcsa-brochure-part-396.pdf" },
    relatedComplianceSlug: "annual-dot-inspection",
    sources: [
      { label: "eCFR — 49 CFR 396.17", url: "https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-396/section-396.17" },
      { label: "FMCSA — Part 396 inspection, repair, and maintenance guide", url: "https://www.fmcsa.dot.gov/sites/fmcsa.dot.gov/files/docs/fmcsa-brochure-part-396.pdf" }
    ]
  },
  {
    slug: "set-up-clearinghouse",
    category: "DRIVER ONBOARDING",
    title: "How to set up an FMCSA Clearinghouse account",
    metaTitle: "How to Set Up an FMCSA Clearinghouse Employer Account",
    metaDescription: "Create the correct Clearinghouse role, connect the company, designate a C/TPA when required, purchase queries, and prepare for driver consent.",
    intro: "Set the account up before you need a pre-employment query. Owner-operators have an extra step: they must work with a consortium/third-party administrator for their own drug and alcohol program.",
    reviewed: "August 21, 2026",
    time: "Usually 15–30 minutes if company verification is straightforward",
    cost: "Account registration is free; queries are purchased separately",
    gather: ["Login.gov credentials", "USDOT number and company information", "Your role with the company", "C/TPA information when applicable", "Payment method for a query plan"],
    steps: [
      { title: "Register through the official Clearinghouse", text: "Use Login.gov and select the role that matches what you actually do—employer, driver, or both when applicable." },
      { title: "Connect the employer account", text: "Associate the account with the correct company and USDOT information, then confirm the company details." },
      { title: "Designate a C/TPA when required", text: "An owner-operator must designate a C/TPA. Other employers may use one, but should grant only the permissions needed for the work being performed." },
      { title: "Purchase a query plan", text: "Pre-employment and annual queries require a query balance. Buying a plan does not run a query by itself." },
      { title: "Prepare the driver side", text: "A driver needs a Clearinghouse account to provide electronic consent for a full query. Build that step into onboarding instead of discovering it on the first workday." },
      { title: "Run and retain the required queries", text: "Complete the pre-employment query before safety-sensitive work and then track the annual query from its actual completion date." }
    ],
    keep: ["Company-account confirmation", "C/TPA designation and permissions", "Query-plan receipt", "Query results and required consents"],
    caution: "Creating an account does not enroll a driver in a testing consortium, order a drug test, or complete a query. Those are separate actions.",
    primaryAction: { label: "Register with the FMCSA Clearinghouse", url: "https://clearinghouse.fmcsa.dot.gov/Register" },
    relatedComplianceSlug: "clearinghouse-annual-query",
    sources: [
      { label: "FMCSA Clearinghouse — Registration", url: "https://clearinghouse.fmcsa.dot.gov/Register" },
      { label: "FMCSA Clearinghouse — Employer Learning Center", url: "https://clearinghouse.fmcsa.dot.gov/Learn/Employer" }
    ]
  },
  {
    slug: "enroll-drug-alcohol-consortium",
    category: "DRIVER ONBOARDING",
    title: "How to enroll in a drug and alcohol testing consortium",
    metaTitle: "How to Join a DOT Drug and Alcohol Testing Consortium",
    metaDescription: "Confirm Part 382 applies, compare C/TPA services, enroll the company and drivers, complete pre-employment testing, and retain proof of the program.",
    intro: "A consortium/third-party administrator can manage random selections, testing coordination, and program records. The carrier still remains responsible for compliance, so know exactly what the provider is—and is not—handling.",
    reviewed: "August 21, 2026",
    time: "Often one business day; testing and verification can take longer",
    cost: "Request the provider's current enrollment, testing, and renewal charges in writing",
    gather: ["Company and USDOT information", "Covered driver roster", "Designated employer representative contact", "Prior-program and pre-employment testing information", "Clearinghouse employer account"],
    steps: [
      { title: "Confirm who is covered", text: "Identify drivers subject to 49 CFR Part 382. Owner-operators must participate through a C/TPA rather than managing their own random-testing pool alone." },
      { title: "Compare the actual service", text: "Ask whether the price includes random-pool management, collection-site coordination, MRO services, Clearinghouse reporting or assistance, supervisor training support, and access to records." },
      { title: "Enroll the company and each covered driver", text: "Provide accurate driver and contact information, name the designated employer representative, and get written confirmation of the effective date." },
      { title: "Complete pre-employment requirements", text: "A driver cannot perform safety-sensitive functions until the required pre-employment drug-test result and Clearinghouse query are complete." },
      { title: "Make the Clearinghouse designation", text: "If the provider will act as the C/TPA in the Clearinghouse, grant the correct permissions. Owner-operators must complete the required designation." },
      { title: "Keep the program active", text: "Respond promptly to random selections, update the roster when drivers enter or leave, retain records, and verify that reports reach the Clearinghouse when required." }
    ],
    keep: ["Enrollment confirmation and effective date", "Covered-driver roster", "Written scope of the provider's services", "Test results and random-selection records", "Clearinghouse designation and reporting records"],
    caution: "FMCSA does not certify or endorse C/TPAs. Hiring one does not transfer the carrier's legal responsibility, so verify the provider's work and keep access to your records.",
    primaryAction: { label: "See New Era's consortium service", url: "https://www.neweradrugtesting.com/dot-drug-testing-consortium/" },
    alternateActions: [
      { label: "Sign in to New Era", url: "https://account.neweradrugtesting.com/login", note: "New Era is the provider Aaron used and had a great experience with. It is an independent private company, not a government agency. This sign-in is for companies that already have an account." }
    ],
    relatedComplianceSlug: "drug-alcohol-consortium",
    sources: [
      { label: "FMCSA — What C/TPAs are", url: "https://www.fmcsa.dot.gov/regulations/drug-alcohol-testing/what-are-consortiumthird-party-administrators" },
      { label: "FMCSA Safety Planner — Owner-operator C/TPA requirement", url: "https://csa.fmcsa.dot.gov/safetyplanner/myfiles/SubSections.aspx?ch=23&eta=23171&sec=70&sub=181" }
    ]
  },
  {
    slug: "file-boc-3",
    category: "OPERATING AUTHORITY",
    title: "How to get a BOC-3 filed",
    metaTitle: "How to File a BOC-3 Process Agent Designation",
    metaDescription: "Choose a process-agent company, provide the correct carrier information, have the BOC-3 filed with FMCSA, verify the record, and keep a copy.",
    intro: "A BOC-3 names process agents who can receive legal documents for the company. Most motor carriers use a blanket process-agent company that files electronically with FMCSA.",
    reviewed: "August 21, 2026",
    time: "Ask the provider for its filing turnaround and verify the federal record afterward",
    cost: "The private provider sets the fee—confirm the one-time and any ongoing charges before ordering",
    gather: ["Exact legal business name", "Principal business address", "USDOT and MC numbers when assigned", "Company contact information", "Operating-authority application details"],
    steps: [
      { title: "Use FMCSA's process-agent list", text: "Choose a blanket company or otherwise ensure there is an agent in every jurisdiction required for the operation." },
      { title: "Give the provider exact company information", text: "A mismatch in legal name, address, or authority number can delay the filing or attach it to the wrong record." },
      { title: "Authorize the filing", text: "For a motor carrier, the process agent files the BOC-3 electronically with FMCSA. Follow the provider's payment and authorization process." },
      { title: "Verify FMCSA received it", text: "Do not rely only on the provider's order receipt. Confirm that the filing appears in the federal record or the authority process advances." },
      { title: "Keep a copy at the business", text: "Retain the filed BOC-3 and provider information at the principal place of business." },
      { title: "Refile when the designation changes", text: "If the process-agent arrangement changes, complete the replacement filing instead of merely editing an internal contact list." }
    ],
    keep: ["Filed BOC-3 copy", "Provider receipt", "Process-agent company contact information", "Confirmation in the FMCSA record"],
    caution: "A BOC-3 does not create operating authority by itself. It is one part of the authority process, along with the application, insurance filing, and other applicable requirements.",
    primaryAction: { label: "View FMCSA's process-agent list", url: "https://www.fmcsa.dot.gov/registration/process-agents" },
    relatedComplianceSlug: "boc-3-process-agent",
    sources: [{ label: "FMCSA — Form BOC-3 designation of process agents", url: "https://www.fmcsa.dot.gov/registration/form-boc-3-designation-agents-service-process" }]
  },
  {
    slug: "set-up-login-gov",
    category: "ACCOUNT ACCESS",
    title: "How to set up Login.gov for FMCSA systems",
    metaTitle: "How to Set Up Login.gov for FMCSA Systems",
    metaDescription: "Create and protect a Login.gov account, prepare for identity verification, and know where to get help when FMCSA access does not connect correctly.",
    intro: "Login.gov is the sign-in service used by federal systems including FMCSA services. It proves who is signing in; the FMCSA system still controls the company, employer, driver, or C/TPA access behind that sign-in.",
    reviewed: "August 22, 2026",
    time: "Account creation may take a few minutes; identity or agency verification can take longer",
    cost: "No Login.gov account fee",
    gather: [
      "An email address you control and will keep",
      "A phone or another supported authentication method",
      "An accepted, unexpired identification document if identity verification is requested",
      "Your personal information exactly as it appears on the identification document",
      "The FMCSA service you are trying to reach and your role in that service",
    ],
    steps: [
      { title: "Begin from the FMCSA service", text: "Start at Motus, the Clearinghouse, or the other official FMCSA page you need, then choose the Login.gov sign-in option. Beginning from the agency helps return you to the correct service after authentication." },
      { title: "Use an email address you will retain", text: "Create the Login.gov account with an address you personally control and can recover. When FMCSA instructs an existing company official to use an email already associated with the company record, follow that agency-specific instruction." },
      { title: "Add more than one authentication method", text: "Login.gov supports several security methods. Set up a backup method when available so a lost phone does not become a lost company-access problem." },
      { title: "Complete identity verification when requested", text: "Enter your information carefully and use clear, uncropped ID images without glare. Login.gov may offer online or in-person verification options depending on the partner agency and situation." },
      { title: "Return to FMCSA and confirm the correct role", text: "A successful Login.gov sign-in does not automatically grant access to a carrier or assign the correct Clearinghouse role. Finish the company, employer, driver, or C/TPA connection inside the FMCSA service." },
      { title: "Save recovery information securely", text: "Keep the personal key and backup authentication method in a secure place. Do not put passwords, Social Security numbers, ID images, or authentication codes in the compliance tracker." },
    ],
    keep: [
      "The email address used for the account",
      "A secure record of backup authentication methods",
      "The Login.gov personal key in a secure location",
      "FMCSA confirmation showing the connected company or role",
    ],
    caution: "Login.gov can help with sign-in and identity verification, but it cannot change an FMCSA application, company record, role, or registration status. Use the FMCSA service's support channel for an agency-access problem.",
    primaryAction: { label: "Open Login.gov", url: "https://secure.login.gov/" },
    alternateActions: [
      { label: "Get official Login.gov help", url: "https://www.login.gov/help/", note: "Use Login.gov support for sign-in, authentication, or identity-verification trouble. Use FMCSA support for company records, roles, and registration status." },
    ],
    relatedComplianceSlug: "fmcsa-portal-motus",
    sources: [
      { label: "Login.gov — Create an account", url: "https://www.login.gov/help/create-an-account/" },
      { label: "Login.gov — Verify your identity", url: "https://www.login.gov/help/verify-your-identity/" },
      { label: "Login.gov — Contact support", url: "https://www.login.gov/contact/" },
      { label: "FMCSA — Registration Resources Hub", url: "https://www.fmcsa.dot.gov/registration/resources-hub" },
    ]
  }
];

export const howToGuideBySlug = Object.fromEntries(howToGuides.map(guide => [guide.slug, guide]));
