import { additionalCompliancePages } from "./additionalPublicCompliancePages";

export type ComplianceTable = { headers: string[]; rows: string[][] };
export type ComplianceSection = { heading: string; paragraphs?: string[]; bullets?: string[]; table?: ComplianceTable; callout?: string };
export type ComplianceFaq = { question: string; answer: string };
export type ComplianceSource = { label: string; url: string };
export type CompliancePage = {
  slug: string;
  eyebrow: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  shortVersion: string;
  lastReviewed: string;
  maintenanceNote?: string;
  toolLink?: { label: string; href: "/tools/mcs-150-due-date-calculator" };
  sections: ComplianceSection[];
  faqs: ComplianceFaq[];
  related: { slug: string; label: string }[];
  sources: ComplianceSource[];
};

export const compliancePages: CompliancePage[] = [
  {
    slug: "mcs-150-biennial-update",
    eyebrow: "FMCSA REGISTRATION",
    title: "MCS-150 Biennial Update: Due Dates and How It Works",
    metaTitle: "MCS-150 Biennial Update: Due Dates & How It Works",
    metaDescription: "Find your MCS-150 biennial update schedule from your USDOT number, understand the Motus transition, and see what to verify before filing.",
    shortVersion: "Your scheduled MCS-150 biennial update comes from two digits of your USDOT number: the last digit sets the month and the next-to-last digit sets odd or even filing years. FMCSA's Motus registration system is now live, but the filing obligation and the need to keep your record current still apply.",
    lastReviewed: "August 19, 2026",
    maintenanceNote: "Current FMCSA notice: the agency has temporarily suspended inactivation of USDOT numbers for entities that have not completed the required biennial update since June 1, 2026. The biennial update requirement itself remains in place. Check the official FMCSA source below for the current status before relying on an enforcement consequence.",
    toolLink: { label: "Calculate your scheduled MCS-150 date", href: "/tools/mcs-150-due-date-calculator" },
    sections: [
      {
        heading: "What the MCS-150 is",
        paragraphs: [
          "The MCS-150 is the Motor Carrier Identification Report used to create and maintain information tied to a USDOT number. It includes items such as mileage, power-unit count, driver count, cargo classifications, and contact information.",
          "FMCSA requires entities under its jurisdiction to update their registration information every two years. The scheduled biennial date is not the only time an update can be needed: changes to carrier information should also be reported in a timely manner."
        ]
      },
      {
        heading: "How the biennial schedule is determined",
        paragraphs: ["Two digits of the USDOT number control the recurring schedule."],
        table: {
          headers: ["USDOT number ends in", "Scheduled month"],
          rows: [["1","January"],["2","February"],["3","March"],["4","April"],["5","May"],["6","June"],["7","July"],["8","August"],["9","September"],["0","October"]]
        },
        callout: "The next-to-last digit sets the filing year: odd digit = odd-numbered years; even digit = even-numbered years. Example: USDOT 3216547 ends in 7, so July. The next-to-last digit is 4, so the scheduled filing is in even-numbered years."
      },
      {
        heading: "Motus replaced the old registration workflow",
        paragraphs: [
          "FMCSA began shutting down legacy registration functions on May 14, 2026, and Motus: USDOT Registration System launched for motor carriers and other registrants on May 19, 2026.",
          "Registration options in the old FMCSA Portal are no longer available. Motus uses Login.gov, and FMCSA says electronic registration work in the new system removes the need for USDOT PINs.",
          "FMCSA also says the transition to a fully online process is still subject to future rulemaking for paper forms. Current agency guidance says existing paper forms continue to be accepted, although online processing is the faster path."
        ]
      },
      {
        heading: "What it costs",
        paragraphs: [
          "FMCSA does not charge a fee to update your carrier information. Third-party filing services may charge for preparing or submitting an update on your behalf.",
          "If someone contacts you demanding payment simply because a biennial update is due, verify the situation directly with FMCSA before paying a private filing service."
        ]
      },
      {
        heading: "What to keep in mind if you are late",
        paragraphs: [
          "The standard FMCSA rule allows USDOT inactivation and civil penalties for failure to complete a required biennial update. However, FMCSA currently has a temporary Motus-related suspension of certain biennial-update inactivations in effect.",
          "That temporary enforcement change is exactly why a dated resource matters: do not assume an old article describes what FMCSA is doing today. Verify your record and current agency guidance."
        ]
      }
    ],
    faqs: [
      { question: "Do I file if nothing changed?", answer: "Yes. The biennial update is a recurring requirement even when the information on file has not changed." },
      { question: "My USDOT number ends in 5. Is it due every May?", answer: "No. The final digit gives you May, but the next-to-last digit determines whether the filing year is odd or even." },
      { question: "Does FMCSA charge to update the MCS-150?", answer: "FMCSA does not charge a fee to update your information. A private filing service can charge for its own service." },
      { question: "Do I still use the old FMCSA Portal for registration changes?", answer: "No. Registration options in the legacy Portal were disabled during the May 2026 transition. Motus is the current USDOT registration system." }
    ],
    related: [
      { slug: "ucr-registration", label: "UCR registration" },
      { slug: "form-2290-hvut", label: "Form 2290" },
      { slug: "ifta-filing", label: "IFTA filing" }
    ],
    sources: [
      { label: "FMCSA — Registration Modernization Resources Hub", url: "https://www.fmcsa.dot.gov/registration/resources-hub" },
      { label: "FMCSA — Registration Modernization FAQs", url: "https://www.fmcsa.dot.gov/registration/modernization-faqs" },
      { label: "FMCSA — Updating Your Registration or Authority", url: "https://www.fmcsa.dot.gov/registration/updating-your-registration" }
    ]
  },
  {
    slug: "ucr-registration",
    eyebrow: "ANNUAL REGISTRATION",
    title: "UCR Registration: 2026 Fees, Timing, and What to Track",
    metaTitle: "UCR Registration: 2026 Fees, Timing & What to Track",
    metaDescription: "See the official 2026 UCR fee brackets, when registration opens, when enforcement begins, and how the annual registration cycle works.",
    shortVersion: "UCR is an annual registration program for entities subject to the Unified Carrier Registration Agreement. For the 2026 registration year, the 0–2 vehicle bracket is $46. The 2026 portal opened October 1, 2025, and subject entities should complete registration before January 1 of the registration year.",
    lastReviewed: "August 19, 2026",
    maintenanceNote: "UCR fees can change by registration year. The amounts below are labeled specifically for 2026 and should be reviewed before the next registration cycle.",
    sections: [
      {
        heading: "What UCR is",
        paragraphs: [
          "Unified Carrier Registration is a federally established, state-administered registration program. Subject carriers and other regulated entities register annually and pay a fee based on the applicable bracket.",
          "UCR is separate from your USDOT registration, operating authority, IRP registration, and IFTA account."
        ]
      },
      {
        heading: "Official 2026 fee brackets",
        table: {
          headers: ["Vehicles", "Carrier / forwarder", "Broker / leasing company"],
          rows: [["0–2","$46","$46"],["3–5","$138","—"],["6–20","$276","—"],["21–100","$963","—"],["101–1,000","$4,592","—"],["1,001+","$44,836","—"]]
        },
        callout: "These are the approved 2026 UCR fees published by the UCR Plan. Do not carry these numbers forward to another registration year without checking the current fee table."
      },
      {
        heading: "When to register",
        paragraphs: [
          "The UCR Plan says the 2026 Registration Portal opened October 1, 2025. An entity subject to UCR must complete its registration and pay the fee before January 1 of the registration year to avoid exposure to state enforcement action.",
          "The practical workflow is simple: treat October through December as the annual registration window instead of waiting until enforcement has already begun."
        ]
      },
      {
        heading: "Why the vehicle count matters",
        paragraphs: [
          "The fee changes substantially as the vehicle bracket changes. That makes the vehicle count on your registration data worth reviewing rather than treating it as a background number.",
          "For a small operation, moving between the 0–2 and 3–5 brackets changes the 2026 fee from $46 to $138."
        ]
      },
      {
        heading: "Penalties are state-administered",
        paragraphs: [
          "There is not one universal federal dollar fine for UCR noncompliance. Enforcement is handled by states, so consequences vary by jurisdiction.",
          "The useful deadline to remember is therefore not a single national fine date; it is the point at which you should already be registered before state enforcement begins."
        ]
      }
    ],
    faqs: [
      { question: "What is the 2026 UCR fee for one or two vehicles?", answer: "The official 2026 0–2 vehicle bracket is $46 for a carrier or forwarder." },
      { question: "When did 2026 UCR registration open?", answer: "The UCR Plan says the 2026 registration portal opened October 1, 2025." },
      { question: "Is UCR the same as IFTA or IRP?", answer: "No. UCR is a separate annual registration program. IFTA handles fuel-tax reporting and IRP handles apportioned vehicle registration." },
      { question: "Are UCR penalties the same in every state?", answer: "No. UCR enforcement is state-administered, so specific penalties vary by jurisdiction." }
    ],
    related: [
      { slug: "mcs-150-biennial-update", label: "MCS-150 biennial update" },
      { slug: "ifta-filing", label: "IFTA filing" },
      { slug: "form-2290-hvut", label: "Form 2290" }
    ],
    sources: [
      { label: "UCR Plan — Official Fee Brackets", url: "https://plan.ucr.gov/fee-brackets/" },
      { label: "UCR Plan — Official Site", url: "https://plan.ucr.gov/" }
    ]
  },
  {
    slug: "form-2290-hvut",
    eyebrow: "HEAVY VEHICLE USE TAX",
    title: "Form 2290: Due Dates and Heavy Vehicle Use Tax Basics",
    metaTitle: "Form 2290 Due Dates & Heavy Vehicle Use Tax Basics",
    metaDescription: "See when Form 2290 is due, who must file, how the month of first use controls the deadline, and why Schedule 1 matters for registration.",
    shortVersion: "Form 2290 applies to taxable highway motor vehicles with a taxable gross weight of 55,000 pounds or more. The deadline depends on the month the vehicle is first used on public highways during the tax period. A vehicle first used in July 2026 is due August 31, 2026.",
    lastReviewed: "August 19, 2026",
    maintenanceNote: "Form 2290 deadlines can shift to the next business day when a normal due date falls on a weekend or legal holiday. Always use the IRS table for the specific tax period before filing.",
    sections: [
      {
        heading: "Who must file",
        paragraphs: [
          "The IRS requires Form 2290 when a highway motor vehicle with a taxable gross weight of 55,000 pounds or more is registered, or required to be registered, in your name at the time of its first use on public highways during the tax period.",
          "The current Form 2290 tax period runs July 1, 2026 through June 30, 2027."
        ]
      },
      {
        heading: "The deadline follows the month of first use",
        paragraphs: ["Form 2290 is generally due by the last day of the month following the month of first use on a public highway during the tax period."],
        table: {
          headers: ["First used", "Normal filing deadline"],
          rows: [["July","August 31"],["August","September 30"],["September","October 31"],["October","November 30"],["November","December 31"],["December","January 31"],["January","Last day of February"],["February","March 31"],["March","April 30"],["April","May 31"],["May","June 30"],["June","July 31"]]
        },
        callout: "The IRS rolls a due date to the next business day when it lands on a Saturday, Sunday, or legal holiday. For 2026–27, use the IRS's current table rather than assuming every calendar date above is the actual business-day deadline."
      },
      {
        heading: "Schedule 1 is the proof you usually need",
        paragraphs: [
          "The IRS returns a stamped Schedule 1 as proof of payment or filing status. States generally require proof of the tax for a taxable vehicle before registering it.",
          "The IRS says an accepted e-filed return can make the stamped Schedule 1 available within minutes. Electronic filing is required for a return reporting and paying tax on 25 or more vehicles; suspended vehicles do not count toward that 25-vehicle threshold."
        ]
      },
      {
        heading: "Suspended vehicles still get reported",
        paragraphs: [
          "A vehicle expected to run 5,000 miles or less during the tax period, or 7,500 miles or less for an agricultural vehicle, may qualify for suspension of the tax.",
          "Suspension does not mean skipping the return. The vehicle is still reported on Form 2290 as tax-suspended."
        ]
      },
      {
        heading: "Tax depends on weight and time in service",
        paragraphs: [
          "The annual tax table begins at $100 for a non-logging vehicle at 55,000 pounds and reaches $550 above 75,000 pounds. Logging vehicles use a reduced table.",
          "Vehicles first used after July generally use a partial-period tax calculation for the remaining months in the tax period."
        ]
      }
    ],
    faqs: [
      { question: "I bought a truck in November. When is Form 2290 due?", answer: "The normal rule is the last day of the month following the month of first use, so a November first use is normally due December 31, subject to weekend and holiday rules." },
      { question: "Can I skip filing if I expect to run under 5,000 miles?", answer: "No. You may qualify to suspend the tax, but the vehicle is still reported on Form 2290." },
      { question: "Why does Schedule 1 matter?", answer: "The stamped Schedule 1 is commonly used as proof of payment when registering a taxable vehicle with a state." },
      { question: "When is e-filing required?", answer: "The IRS requires electronic filing for a return reporting and paying tax on 25 or more vehicles. Tax-suspended vehicles are not counted toward that threshold." }
    ],
    related: [
      { slug: "ifta-filing", label: "IFTA filing" },
      { slug: "ucr-registration", label: "UCR registration" },
      { slug: "mcs-150-biennial-update", label: "MCS-150 biennial update" }
    ],
    sources: [
      { label: "IRS — When Form 2290 Taxes Are Due", url: "https://www.irs.gov/businesses/small-businesses-self-employed/when-form-2290-taxes-are-due" },
      { label: "IRS — Instructions for Form 2290 (07/2026)", url: "https://www.irs.gov/instructions/i2290" },
      { label: "IRS — Trucking Tax Center", url: "https://www.irs.gov/businesses/small-businesses-self-employed/trucking-tax-center" }
    ]
  },
  {
    slug: "ifta-filing",
    eyebrow: "QUARTERLY FUEL TAX",
    title: "IFTA Filing: Quarterly Deadlines, Zero-Mile Returns, and Records",
    metaTitle: "IFTA Filing: Quarterly Deadlines & What to Track",
    metaDescription: "Keep the four IFTA filing dates straight, understand zero-mile returns, decal timing, recordkeeping, and the official 2026 U.S. interest rate.",
    shortVersion: "IFTA returns are quarterly. The recurring dates are April 30, July 31, October 31, and January 31. A no-operations quarter still requires a return, and the 2026 annual IFTA interest rate for U.S. jurisdictions is 9%.",
    lastReviewed: "August 19, 2026",
    maintenanceNote: "The IFTA interest rate changes on January 1 each year. The 9% figure below is the official U.S. annual rate effective January 1, 2026 and should be rechecked for 2027.",
    sections: [
      {
        heading: "Who generally needs IFTA",
        paragraphs: [
          "IFTA applies when a qualified motor vehicle operates in two or more member jurisdictions. A qualified vehicle includes certain two-axle vehicles over 26,000 pounds, vehicles with three or more axles regardless of weight, and combinations exceeding 26,000 pounds.",
          "Carriers that only cross state lines occasionally may be able to use trip permits instead of maintaining an IFTA license, depending on the trip and jurisdiction."
        ]
      },
      {
        heading: "The four recurring filing dates",
        table: {
          headers: ["Quarter", "Period", "Recurring due date"],
          rows: [["Q1","Jan 1 – Mar 31","April 30"],["Q2","Apr 1 – Jun 30","July 31"],["Q3","Jul 1 – Sep 30","October 31"],["Q4","Oct 1 – Dec 31","January 31"]]
        },
        callout: "A quarter with no operations does not make the filing disappear. A no-operations return is still a return, which is why IFTA is easy to miss when the truck has been parked."
      },
      {
        heading: "License and decals",
        paragraphs: [
          "An IFTA license and decals run on a calendar-year cycle. Renewal season begins before the new year, and the agreement provides a grace period for properly renewed carriers while new credentials are being displayed.",
          "The grace period does not fix delinquent returns or an account that was not renewed in good standing."
        ]
      },
      {
        heading: "Penalty and interest",
        paragraphs: [
          "The IFTA agreement provides a late-return penalty of $50 or 10% of the net tax liability, whichever is greater.",
          "For fleets based in U.S. jurisdictions, IFTA sets interest at two percentage points above the IRS underpayment rate, adjusted each January 1. The official annual rate effective January 1, 2026 is 9%, accruing monthly at one-twelfth of that annual rate."
        ]
      },
      {
        heading: "Records matter as much as the calendar",
        paragraphs: [
          "Your base jurisdiction audits the distance and fuel records supporting the quarterly return. That means keeping reliable jurisdiction mileage and fuel-purchase records, not merely remembering to submit the form.",
          "If you use ELD-generated jurisdiction mileage, reconcile it with the records you plan to use for the return before an audit forces you to do it later."
        ]
      }
    ],
    faqs: [
      { question: "Do I file an IFTA return if I ran zero miles?", answer: "Yes. A no-operations quarter still requires a return while the account is active." },
      { question: "What are the four recurring IFTA due dates?", answer: "April 30, July 31, October 31, and January 31." },
      { question: "What is the 2026 U.S. IFTA interest rate?", answer: "IFTA publishes a 9% annual interest rate for U.S. jurisdictions effective January 1, 2026." },
      { question: "Is IFTA the same as IRP?", answer: "No. IFTA is fuel-tax reporting; IRP is apportioned vehicle registration." }
    ],
    related: [
      { slug: "form-2290-hvut", label: "Form 2290" },
      { slug: "ucr-registration", label: "UCR registration" },
      { slug: "mcs-150-biennial-update", label: "MCS-150 biennial update" }
    ],
    sources: [
      { label: "IFTA, Inc. — Official Annual Interest Rate", url: "https://www.iftach.org/interestrate.php" },
      { label: "IFTA, Inc. — Carrier Information", url: "https://www.iftach.org/Carriers/index.php" }
    ]
  }
  ,
  {
    slug: "cdl-expiration",
    eyebrow: "DRIVER CREDENTIAL",
    title: "CDL Expiration: What Carriers Need to Track",
    metaTitle: "CDL Expiration: What Carriers Need to Track",
    metaDescription: "Track the actual CDL expiration date for each driver, understand why the state-issued date controls, and know how Clearinghouse status can affect renewal.",
    shortVersion: "A CDL is issued and renewed by the driver's State Driver Licensing Agency, so the actual expiration date printed or recorded for that driver is the date that matters. We Heart Paperwork tracks that real date instead of assuming a standard license term.",
    lastReviewed: "August 19, 2026",
    sections: [
      {
        heading: "The state-issued expiration date is the source of truth",
        paragraphs: [
          "Commercial driver's licenses are issued by State Driver Licensing Agencies. Renewal periods and procedures vary, so a carrier should use the actual expiration date associated with the driver's current credential instead of calculating one from a generic term.",
          "That is also how We Heart Paperwork handles CDL expiration: you save the driver's actual date and update it when the license is renewed."
        ]
      },
      {
        heading: "An expired or invalid CDL is an operating problem, not just a paperwork problem",
        paragraphs: [
          "A motor carrier may not knowingly allow, require, permit, or authorize a driver to operate a commercial motor vehicle when the driver does not hold the required valid CDL or is disqualified, suspended, revoked, or otherwise prohibited from operating.",
          "The practical point is simple: do not treat CDL expiration as a date to clean up after the fact. It needs to be visible early enough to allow time for the driver to complete the State renewal process."
        ]
      },
      {
        heading: "Clearinghouse status now matters at the licensing counter",
        paragraphs: [
          "Since November 18, 2024, State Driver Licensing Agencies must query the FMCSA Drug and Alcohol Clearinghouse before specified CDL and CLP transactions, including renewals.",
          "A driver in prohibited status can be denied the transaction or have commercial driving privileges downgraded until the return-to-duty process is completed and the Clearinghouse status changes."
        ]
      },
      {
        heading: "What to keep current for each driver",
        bullets: [
          "CDL number",
          "Issuing State",
          "CDL class",
          "Actual expiration date",
          "Any endorsements or restrictions that matter to the work the driver performs"
        ],
        callout: "We Heart Paperwork currently tracks the driver's license number, State, class, and actual expiration date. It does not invent a future expiration date or assume every State uses the same renewal period."
      }
    ],
    faqs: [
      { question: "Does every CDL have the same renewal period?", answer: "No. CDL issuance and renewal are handled by the States. Track the actual expiration date on the driver's current credential rather than assuming a standard term." },
      { question: "Can a driver keep working after the CDL expires?", answer: "A carrier should not allow a driver to operate a CDL-required CMV without the required valid commercial driving privilege." },
      { question: "Does the Clearinghouse affect CDL renewal?", answer: "Yes. Since November 18, 2024, State Driver Licensing Agencies query the Clearinghouse before specified CDL and CLP transactions, including renewals. Prohibited status can block the transaction and trigger a downgrade." },
      { question: "Does We Heart Paperwork calculate the next CDL expiration?", answer: "No. The app stores the actual expiration date you enter from the driver's current State-issued credential." }
    ],
    related: [
      { slug: "dot-medical-card", label: "DOT medical qualification" },
      { slug: "annual-mvr", label: "Annual MVR review" },
      { slug: "clearinghouse-annual-query", label: "Clearinghouse annual query" },
      { slug: "driver-qualification-file", label: "Driver qualification file" }
    ],
    sources: [
      { label: "FMCSA — Commercial Driver's License Program", url: "https://www.fmcsa.dot.gov/registration/commercial-drivers-license" },
      { label: "FMCSA Clearinghouse — CDL Downgrades", url: "https://clearinghouse.fmcsa.dot.gov/Learn/News/Item/Clearinghouse-II-begins" },
      { label: "FMCSA Clearinghouse — About Clearinghouse II", url: "https://clearinghouse.fmcsa.dot.gov/about" }
    ]
  },
  {
    slug: "dot-medical-card",
    eyebrow: "DRIVER MEDICAL QUALIFICATION",
    title: "DOT Medical Qualification: Expiration Dates and the NRII Transition",
    metaTitle: "DOT Medical Qualification: Expiration & NRII Changes",
    metaDescription: "Understand the maximum medical certification period, why the actual expiration date matters, and how NRII changed medical certification records for CDL drivers.",
    shortVersion: "Federal rules generally require a driver to be medically examined and certified at least every 24 months, but many drivers receive shorter certification periods. The actual expiration date for that driver is the date to track.",
    lastReviewed: "August 19, 2026",
    maintenanceNote: "Time-sensitive NRII transition: FMCSA's current nationwide exemption allows CDL/CLP holders and motor carriers to rely on a paper Medical Examiner's Certificate as proof for up to 60 days after issuance. The exemption is scheduled to expire October 11, 2026. Recheck FMCSA guidance before relying on this paragraph after that date.",
    sections: [
      {
        heading: "Twenty-four months is a maximum, not a promise",
        paragraphs: [
          "49 CFR 391.45 generally requires a driver who has not been medically examined and certified during the preceding 24 months to be examined again.",
          "Some drivers are subject to shorter examination intervals, and a medical examiner can issue a certificate for less than the maximum period. That is why tracking a made-up two-year date is risky: use the actual medical qualification expiration date for the driver."
        ]
      },
      {
        heading: "NRII changed how CDL medical information moves",
        paragraphs: [
          "Under National Registry II, certified medical examiners electronically transmit examination results to FMCSA, and participating State Driver Licensing Agencies post the medical certification information to the driver's CDLIS motor vehicle record.",
          "For motor carriers, FMCSA says the CDLIS driver MVR is now an important source of medical certification information that belongs in the driver qualification file."
        ]
      },
      {
        heading: "The temporary paper-certificate exemption is still active",
        paragraphs: [
          "FMCSA issued a nationwide temporary exemption during the NRII transition. It allows interstate CDL/CLP holders and motor carriers to rely on a paper copy of a current Medical Examiner's Certificate as proof for up to 60 days after the certificate was issued.",
          "The exemption runs from April 11, 2026 through October 11, 2026. FMCSA has said it does not anticipate another nationwide extension, so this page needs to be checked again before that date."
        ]
      },
      {
        heading: "A practical renewal workflow",
        bullets: [
          "Schedule the physical before the saved expiration date",
          "Use an examiner listed on FMCSA's National Registry",
          "Save the actual new expiration date after the examination",
          "Verify that the updated medical status appears where required in the driver's State/CDLIS record",
          "Keep the records required for the driver qualification file"
        ],
        callout: "We Heart Paperwork tracks the actual medical qualification expiration date you save. It does not automatically add two years because the next certificate may be shorter."
      }
    ],
    faqs: [
      { question: "Is every DOT medical certification good for two years?", answer: "No. Twenty-four months is the general maximum interval for many drivers, but shorter certification periods apply in some situations and may also be issued by the medical examiner." },
      { question: "Why should I track the actual expiration date?", answer: "Because the driver's next certificate may be shorter than two years. The current credential or medical qualification record is the source of truth." },
      { question: "What changed with NRII?", answer: "Medical examiners electronically transmit CDL/CLP examination results to FMCSA, and participating States use that information in CDLIS. Motor carriers should use current FMCSA guidance for the medical documentation they retain." },
      { question: "Is the paper medical card still useful right now?", answer: "Yes during the current transition. A temporary nationwide FMCSA exemption through October 11, 2026 allows reliance on a paper certificate for up to 60 days after issuance when its conditions are met." }
    ],
    related: [
      { slug: "cdl-expiration", label: "CDL expiration" },
      { slug: "annual-mvr", label: "Annual MVR review" },
      { slug: "clearinghouse-annual-query", label: "Clearinghouse annual query" },
      { slug: "driver-qualification-file", label: "Driver qualification file" }
    ],
    sources: [
      { label: "eCFR — 49 CFR 391.45 Medical Examination and Certification", url: "https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-391/subpart-E/section-391.45" },
      { label: "FMCSA — National Registry II Learning Center", url: "https://nationalregistry.fmcsa.dot.gov/nriilearning-center" },
      { label: "FMCSA — Temporary NRII Exemption Through October 11, 2026", url: "https://www.fmcsa.dot.gov/newsroom/fmcsa-issues-temporary-exemption-support-nrii-transition" }
    ]
  },
  {
    slug: "annual-mvr",
    eyebrow: "ANNUAL DRIVER REVIEW",
    title: "Annual MVR Review: What 49 CFR 391.25 Requires",
    metaTitle: "Annual MVR Review Requirements | 49 CFR 391.25",
    metaDescription: "Learn the two-part annual MVR requirement: obtain the driver's motor vehicle record, review it, and keep a dated reviewer note in the qualification file.",
    shortVersion: "At least once every 12 months, a motor carrier must obtain the driver's motor vehicle record and review it for continued qualification. The regulation also requires a note identifying who performed the review and the date of the review.",
    lastReviewed: "August 19, 2026",
    sections: [
      {
        heading: "There are two separate annual tasks",
        paragraphs: [
          "First, at least once every 12 months, the motor carrier must make an inquiry to obtain the motor vehicle record for each employed driver, covering at least the preceding 12 months, from the licensing authority or authorities required by 49 CFR 391.25.",
          "Second, the motor carrier must review that driving record to determine whether the driver continues to meet the minimum requirements for safe driving and is not disqualified from operating a commercial motor vehicle."
        ]
      },
      {
        heading: "The review is more than filing the MVR",
        paragraphs: [
          "During the review, the carrier must consider evidence of violations of the Federal Motor Carrier Safety Regulations and applicable motor-vehicle laws, as well as the driver's accident record.",
          "The rule specifically says to give great weight to violations such as speeding, reckless driving, and operating under the influence because they can show disregard for public safety."
        ]
      },
      {
        heading: "The reviewer note belongs in the qualification file",
        paragraphs: [
          "49 CFR 391.25 requires a copy of the annual motor vehicle record to be maintained in the driver's qualification file.",
          "It also separately requires a note that includes the name of the person who performed the review and the date of the review. That means simply pulling an MVR and dropping it into a file does not document the second half of the requirement."
        ],
        callout: "The annual MVR is a recurring date-based requirement in We Heart Paperwork. The app tracks when the review was completed and the next annual cycle, while the actual MVR and required review documentation remain part of the carrier's records."
      },
      {
        heading: "Why the date is easy to lose",
        paragraphs: [
          "The rule is at least once every 12 months, so the next review is tied to the prior review cycle rather than one universal federal calendar date.",
          "A per-driver date is therefore more useful than a company-wide annual reminder when drivers were hired or reviewed at different times."
        ]
      }
    ],
    faqs: [
      { question: "How often is the annual MVR review required?", answer: "At least once every 12 months for each employed driver covered by the rule." },
      { question: "Is pulling the MVR enough?", answer: "No. The carrier must also review the driving record and keep a note with the reviewer's name and the date of the review." },
      { question: "What records go in the driver qualification file?", answer: "49 CFR 391.25 requires the motor vehicle record obtained for the annual inquiry and a note documenting who reviewed the record and when." },
      { question: "Does We Heart Paperwork store the MVR document itself?", answer: "The current tracker is focused on the recurring review date and completion history. The carrier remains responsible for maintaining the required underlying driver qualification records." }
    ],
    related: [
      { slug: "cdl-expiration", label: "CDL expiration" },
      { slug: "dot-medical-card", label: "DOT medical qualification" },
      { slug: "clearinghouse-annual-query", label: "Clearinghouse annual query" },
      { slug: "driver-qualification-file", label: "Driver qualification file" }
    ],
    sources: [
      { label: "eCFR — 49 CFR 391.25 Annual Inquiry and Review of Driving Record", url: "https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-391/subpart-C/section-391.25" },
      { label: "FMCSA Motor Carrier Safety Planner — Annual Review of Driving Record", url: "https://csa.fmcsa.dot.gov/SafetyPlanner/Resources/FormsLibrary.aspx" }
    ]
  },
  {
    slug: "clearinghouse-annual-query",
    eyebrow: "DRUG & ALCOHOL CLEARINGHOUSE",
    title: "Clearinghouse Annual Query: The Rolling 12-Month Requirement",
    metaTitle: "Clearinghouse Annual Query: Rolling 12-Month Rule",
    metaDescription: "Understand the FMCSA Clearinghouse annual-query schedule, limited vs. full queries, driver consent, and the special C/TPA requirement for owner-operators.",
    shortVersion: "Employers must query the FMCSA Drug and Alcohol Clearinghouse for each current CDL driver at least once within a rolling 12-month period. FMCSA describes the requirement as 365 days from the last query, or another compliant 12-month period chosen by the employer.",
    lastReviewed: "August 19, 2026",
    sections: [
      {
        heading: "The annual query is a rolling requirement",
        paragraphs: [
          "FMCSA says employers must conduct an annual query on current employees at least once within a 365-day period based on the date of the last query, or another 12-month period selected by the employer that still satisfies the regulation.",
          "That means there is no single federal January 1 or December 31 deadline for every driver. If drivers were queried on different dates, they can have different next-query dates."
        ]
      },
      {
        heading: "Limited and full queries serve different purposes",
        paragraphs: [
          "A limited query can satisfy the annual query requirement. It tells the employer whether information exists in the driver's Clearinghouse record without disclosing the detailed record.",
          "A full query discloses the detailed Clearinghouse information and is required for pre-employment queries. Limited queries use general consent obtained outside the Clearinghouse; full queries require the driver's specific electronic consent inside the Clearinghouse."
        ]
      },
      {
        heading: "Owner-operators have an extra setup step",
        paragraphs: [
          "FMCSA says an owner-operator who employs himself or herself as a CDL driver must designate a consortium/third-party administrator (C/TPA) in the Clearinghouse.",
          "Owner-operators must also query the drivers they employ, including themselves. A designated C/TPA may conduct the query on the employer's behalf, but the employer remains responsible for compliance."
        ]
      },
      {
        heading: "Clearinghouse status can affect the CDL itself",
        paragraphs: [
          "Since November 18, 2024, State Driver Licensing Agencies must query the Clearinghouse before specified CDL and CLP transactions and remove commercial driving privileges for drivers in prohibited status.",
          "A prohibited driver must complete the return-to-duty process and have the Clearinghouse status change before commercial driving privileges can be reinstated."
        ],
        callout: "We Heart Paperwork tracks the date of the driver's most recent annual Clearinghouse query so the next rolling annual cycle stays visible. It does not replace the Clearinghouse query itself."
      }
    ],
    faqs: [
      { question: "Is the annual Clearinghouse query due on the same date every year?", answer: "Not necessarily. FMCSA tracks the annual requirement on a rolling 12-month basis tied to the last query, unless the employer uses another compliant 12-month period." },
      { question: "Can a limited query satisfy the annual requirement?", answer: "Yes. FMCSA says limited queries can satisfy the annual query requirement. A full query is required for pre-employment and when detailed information must be accessed." },
      { question: "What consent is required?", answer: "A limited query uses general written or electronic consent obtained outside the Clearinghouse. A full query requires the driver's specific electronic consent inside the Clearinghouse." },
      { question: "Does an owner-operator have to query himself or herself?", answer: "Yes. FMCSA says owner-operators are subject to the employer query requirement and must designate a C/TPA as part of their Clearinghouse setup." }
    ],
    related: [
      { slug: "annual-mvr", label: "Annual MVR review" },
      { slug: "cdl-expiration", label: "CDL expiration" },
      { slug: "dot-medical-card", label: "DOT medical qualification" }
    ],
    sources: [
      { label: "FMCSA Clearinghouse — Annual Query Requirement", url: "https://clearinghouse.fmcsa.dot.gov/FAQ/Topics/Employers%2Cqueries-and-consent-requests" },
      { label: "FMCSA Clearinghouse — Query Plans and Query Types", url: "https://clearinghouse.fmcsa.dot.gov/query/plan" },
      { label: "FMCSA Clearinghouse — Owner-Operator Learning Center", url: "https://clearinghouse.fmcsa.dot.gov/Learn/Owner-Operator" },
      { label: "FMCSA Clearinghouse — Clearinghouse II and CDL Downgrades", url: "https://clearinghouse.fmcsa.dot.gov/Learn/News/Item/Clearinghouse-II-begins" }
    ]
  },
  {
  slug: "driver-qualification-file",
  eyebrow: "DRIVER QUALIFICATION FILE",
  title: "Driver Qualification File Checklist: What 49 CFR 391.51 Requires",
  metaTitle: "Driver Qualification File Checklist: What 391.51 Requires",
  metaDescription:
    "The complete DQ file requirements under 49 CFR 391.51: what belongs in the file, what renews, what is kept separately, and current retention rules.",
  shortVersion:
    "Every motor carrier must maintain a driver qualification file for each driver it employs. The file combines one-time hiring records with recurring items such as the annual MVR review and medical qualification records, each with its own retention rules.",
  lastReviewed: "August 20, 2026",

  sections: [
    {
      heading: "The basic requirement",
      paragraphs: [
        "49 CFR 391.51 requires each motor carrier to maintain a driver qualification file for each driver it employs. The DQ file may be combined with the driver's personnel file.",
        "If you are both the motor carrier and one of its drivers, you still have to satisfy the driver qualification requirements that apply to your operation and maintain the required records.",
      ],
      callout:
        "The DQ file is not one annual form. It is a collection of qualification records created at different times and retained for different periods.",
    },

    {
      heading: "What belongs in the DQ file",
      table: {
        headers: ["Record", "Rule", "When"],
        rows: [
          [
            "Employment application",
            "49 CFR 391.21",
            "At hire",
          ],
          [
            "Initial MVR from each required licensing authority",
            "49 CFR 391.23(a)(1)",
            "Within 30 days of employment",
          ],
          [
            "Road test certificate or accepted equivalent",
            "49 CFR 391.31 / 391.33",
            "At qualification",
          ],
          [
            "Annual MVR",
            "49 CFR 391.25(a)",
            "At least every 12 months",
          ],
          [
            "Annual review note",
            "49 CFR 391.25(c)(2)",
            "At least every 12 months",
          ],
          [
            "Medical qualification record",
            "49 CFR 391.51(b)(6)",
            "Keep current",
          ],
          [
            "Medical variance or SPE certificate, if applicable",
            "49 CFR 391.51(b)(6)-(7)",
            "As applicable",
          ],
          [
            "National Registry verification note, when required",
            "49 CFR 391.51(b)(8)",
            "As applicable",
          ],
        ],
      },
    },

    {
      heading: "The annual MVR and annual review are two different records",
      paragraphs: [
        "At least once every 12 months, the carrier must obtain the driver's motor vehicle record as required by 49 CFR 391.25.",
        "The carrier must also review that record and keep a note identifying the person who performed the review and the date of the review.",
        "That means pulling an MVR and placing it in the file does not by itself document the annual review requirement.",
      ],
      callout:
        "This is why We Heart Paperwork treats the annual MVR review as its own recurring driver deadline rather than burying it inside a one-time DQ checklist.",
    },

    {
      heading: "The road test record can sometimes be a license copy",
      paragraphs: [
        "The DQ file normally contains the driver's road test certificate issued under 49 CFR 391.31.",
        "When the carrier accepts a license or certificate as the permitted equivalent under 49 CFR 391.33, the DQ file instead contains a copy of the license or certificate used as that equivalent.",
        "So a photocopy of a CDL is not automatically a separate DQ-file requirement simply because the driver has a CDL. It matters when the carrier is relying on that credential as the road-test equivalent.",
      ],
    },

    {
      heading: "Previous-employer safety history is required, but kept separately",
      paragraphs: [
        "49 CFR 391.23 requires the carrier to investigate the driver's safety-performance history with DOT-regulated employers during the preceding three years.",
        "Those responses, or documentation of good-faith efforts to obtain them, must be placed in the driver investigation history file rather than simply treated as another general item in the DQ file.",
        "The investigation history file has separate confidentiality and access requirements.",
      ],
      callout:
        "The initial licensing-authority MVR belongs in the DQ file. Previous-employer safety-performance investigation records belong in the separate driver investigation history file.",
    },

    {
      heading: "The annual list of violations is no longer required",
      paragraphs: [
        "FMCSA eliminated the former 49 CFR 391.27 annual list-of-violations requirement effective May 9, 2022.",
        "Drivers no longer have to prepare a separate annual list of traffic convictions or a certification that they had none.",
        "The annual MVR inquiry and annual review requirement under 49 CFR 391.25 remains in effect.",
      ],
      callout:
        "If a checklist still tells every driver to complete a separate annual list of violations, that checklist is using a requirement FMCSA removed in 2022.",
    },

    {
      heading: "Medical records changed for CDL drivers",
      paragraphs: [
        "For CDL holders, the CDLIS motor vehicle record is now central to documenting medical certification status under the current rule.",
        "The older provision allowing a carrier to use a driver's medical examiner certificate for a short period as CDL medical-certification proof ran through June 22, 2025.",
        "For drivers who are not required to hold a CDL, the DQ file still includes the National Registry verification note required by 49 CFR 391.23(m)(1). The corresponding CDL verification-note provision in 49 CFR 391.51(b)(8)(ii) applied only through June 22, 2025.",
        "If medical certification is based on a variance or exemption, the applicable variance documentation must also be retained as required.",
      ],
    },

    {
      heading: "How long DQ records are kept",
      paragraphs: [
        "As a general rule, the driver qualification file must be retained for as long as the driver is employed by the motor carrier and for three years after employment ends.",
        "However, 49 CFR 391.51(d) allows certain recurring records to be removed three years after the date they were executed.",
      ],
      bullets: [
        "Annual MVRs may be removed three years after the date of the record.",
        "Annual review notes may be removed three years after execution.",
        "Medical examiner certificates or required CDLIS MVRs may be removed after the applicable three-year retention period.",
        "Medical variances and SPE certificates listed in the rule may be removed after three years.",
        "National Registry verification notes may be removed after three years.",
      ],
      callout:
        "The three-year rule does not mean the entire active driver's file can be discarded every three years. The file as a whole remains required while the driver is employed.",
    },

    {
      heading: "A practical DQ-file workflow",
      bullets: [
        "Build the initial qualification file when the driver is hired.",
        "Place the initial licensing-authority MVR in the DQ file within the required 30-day window.",
        "Complete and document the road-test requirement or accepted equivalent.",
        "Maintain previous-employer safety-performance investigation records in the separate investigation history file.",
        "Track the annual MVR and annual review date for each driver.",
        "Track the driver's actual medical qualification status and expiration information.",
        "Keep CDL and Clearinghouse obligations visible as separate recurring requirements rather than assuming the DQ file covers every driver-compliance obligation.",
      ],
    },

    {
      heading: "How We Heart Paperwork handles it",
      paragraphs: [
        "We Heart Paperwork separates initial driver qualification setup from the recurring deadlines that continue after the driver is hired.",
        "The DQ checklist is used as an initial setup roadmap. Annual MVR reviews, medical qualification, CDL expiration, and Clearinghouse queries remain separate date-based trackers so each recurring obligation stays visible.",
        "The app helps organize the dates and completion history. The carrier remains responsible for maintaining the actual records required by the regulations.",
      ],
    },
  ],

  faqs: [
    {
      question: "Does every driver need a driver qualification file?",
      answer:
        "49 CFR 391.51 requires each motor carrier to maintain a DQ file for each driver it employs, subject to the scope and exceptions elsewhere in Part 391.",
    },
    {
      question: "Is pulling an annual MVR enough?",
      answer:
        "No. The carrier must obtain the required MVR and separately document the annual review, including the name of the person who performed the review and the date.",
    },
    {
      question: "Do I have to keep a photocopy of every driver's CDL?",
      answer:
        "Not simply because the driver holds a CDL. A copy is required in the DQ file when the carrier relies on the license or certificate as an accepted equivalent to the road test under 49 CFR 391.33.",
    },
    {
      question: "Do drivers still complete an annual list of traffic violations?",
      answer:
        "No. FMCSA removed the former 49 CFR 391.27 annual list-of-violations requirement effective May 9, 2022. The annual MVR inquiry and review requirement remains.",
    },
    {
      question: "Does previous-employer safety history go in the DQ file?",
      answer:
        "The investigation is required, but the responses and good-faith-effort documentation are maintained in the separate driver investigation history file under the Part 391 recordkeeping rules.",
    },
    {
      question: "How long do I keep a DQ file?",
      answer:
        "The DQ file generally must be retained for the driver's entire employment and for three years afterward. Certain recurring records listed in 49 CFR 391.51(d) may be removed three years after execution.",
    },
    {
      question: "Does We Heart Paperwork store the underlying DQ documents?",
      answer:
        "The current product focuses on the qualification checklist, recurring compliance dates, and completion history. The carrier remains responsible for maintaining the underlying required records.",
    },
  ],

  related: [
    {
      slug: "annual-mvr",
      label: "Annual MVR review",
    },
    {
      slug: "dot-medical-card",
      label: "DOT medical qualification",
    },
    {
      slug: "cdl-expiration",
      label: "CDL expiration",
    },
    {
      slug: "clearinghouse-annual-query",
      label: "Clearinghouse annual query",
    },
  ],

  sources: [
    {
      label: "eCFR — 49 CFR 391.51 Driver Qualification Files",
      url: "https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-391/subpart-F/section-391.51",
    },
    {
      label: "eCFR — 49 CFR 391.23 Investigation and Inquiries",
      url: "https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-391/subpart-C/section-391.23",
    },
    {
      label: "eCFR — 49 CFR 391.25 Annual Inquiry and Review",
      url: "https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-391/subpart-C/section-391.25",
    },
    {
      label: "eCFR — 49 CFR 391.31 Road Test",
      url: "https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-391/subpart-D/section-391.31",
    },
    {
      label: "eCFR — 49 CFR 391.33 Equivalent of Road Test",
      url: "https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-391/subpart-D/section-391.33",
    },
    {
      label: "Federal Register — Record of Violations Final Rule",
      url: "https://www.govinfo.gov/content/pkg/FR-2022-03-09/pdf/FR-2022-03-09.pdf",
    },
  ],
},

...additionalCompliancePages,

];

export const compliancePageBySlug = Object.fromEntries(
  compliancePages.map((page) => [page.slug, page])
) as Record<string, CompliancePage>;
