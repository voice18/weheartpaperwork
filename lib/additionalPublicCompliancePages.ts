import type { CompliancePage } from "./publicCompliancePages";

export const additionalCompliancePages: CompliancePage[] = [
  {
    slug: "boc-3-process-agent",
    eyebrow: "OPERATING AUTHORITY",
    title: "BOC-3 Process Agent Filing: What Carriers Need to Maintain",
    metaTitle: "BOC-3 Filing: What Motor Carriers Need to Know",
    metaDescription: "Learn who needs a BOC-3, who files it, when it changes, what record to keep, and why a valid process-agent designation matters.",
    shortVersion: "A BOC-3 names the people or companies authorized to receive legal papers for a carrier. It is usually a status to maintain, not an annual renewal date.",
    lastReviewed: "August 21, 2026",
    sections: [
      {
        heading: "What the BOC-3 does",
        paragraphs: [
          "A process agent is someone authorized to receive legal papers on behalf of a motor carrier, broker, or freight forwarder. Form BOC-3 records those designations with FMCSA.",
          "For-hire carriers generally deal with this while obtaining operating authority. Many use a blanket process-agent company so one filing covers the required states. A private carrier that does not hold operating authority may not have the same filing requirement."
        ],
        callout: "BOC-3 is not something every USDOT-number holder renews each year. First determine whether your authority requires it."
      },
      {
        heading: "When it needs attention",
        bullets: [
          "The required filing is not yet on record when authority is being established.",
          "The process-agent company or designation changes.",
          "The designation becomes invalid or the agent will no longer accept service.",
          "FMCSA requires a new filing during an authority change or reinstatement."
        ],
        paragraphs: [
          "FMCSA says changes are made by filing a new BOC-3. A carrier should also retain its copy at the principal place of business.",
          "This is why We Heart Paperwork treats BOC-3 as a confirmation item. Once the filing is valid, there is no useful annual countdown to invent."
        ]
      },
      {
        heading: "What to verify",
        bullets: [
          "The legal name matches the name tied to the operating authority.",
          "A valid BOC-3 is visible in the carrier's FMCSA record.",
          "The process-agent relationship is still active.",
          "A copy of the filing is available with the company's authority records."
        ]
      }
    ],
    faqs: [
      { question: "Does a BOC-3 expire every year?", answer: "Not as a normal annual renewal. It must remain valid and be replaced when the designation changes or becomes invalid." },
      { question: "Can a carrier file its own BOC-3?", answer: "FMCSA's current form page says motor-carrier filings are made by a process agent on the carrier's behalf. Brokers and freight forwarders without CMVs can have different filing options." },
      { question: "Does every carrier with a USDOT number need one?", answer: "No. Applicability depends on the operation and authority. For-hire operating authority is the common reason a carrier needs a BOC-3." }
    ],
    related: [
      { slug: "motor-carrier-insurance", label: "Motor-carrier insurance" },
      { slug: "fmcsa-portal-motus", label: "FMCSA Portal and Motus" },
      { slug: "mcs-150-biennial-update", label: "MCS-150 update" }
    ],
    sources: [
      { label: "FMCSA — Form BOC-3 and Filing Instructions", url: "https://www.fmcsa.dot.gov/registration/form-boc-3-designation-agents-service-process" },
      { label: "FMCSA — Process Agents", url: "https://www.fmcsa.dot.gov/registration/process-agents" },
      { label: "FMCSA — Invalid BOC-3 Filing Policy", url: "https://www.fmcsa.dot.gov/registration/suspension-motor-carrier-operating-authority-registration-invalid-process-agent-boc-3" }
    ]
  },
  {
    slug: "drug-alcohol-consortium",
    eyebrow: "DRUG AND ALCOHOL PROGRAM",
    title: "DOT Drug and Alcohol Consortium: What an Owner-Operator Still Has to Track",
    metaTitle: "DOT Drug & Alcohol Consortium for Owner-Operators",
    metaDescription: "Understand what a DOT consortium or C/TPA handles, what remains the carrier's responsibility, and which dates are worth tracking.",
    shortVersion: "A consortium or C/TPA can manage parts of a DOT drug and alcohol testing program. It does not take the carrier's responsibility away, and owner-operators have special consortium requirements.",
    lastReviewed: "August 21, 2026",
    sections: [
      {
        heading: "What a consortium does",
        paragraphs: [
          "A consortium/third-party administrator, usually called a C/TPA, can manage some or all of an employer's DOT drug and alcohol testing program. Services commonly include random-pool administration, notices, test coordination, and record support.",
          "Owner-operators cannot simply select themselves for random testing. FMCSA explains that consortiums serving owner-operators have a special role in administering the random program."
        ]
      },
      {
        heading: "What the carrier still owns",
        bullets: [
          "Keeping the company continuously enrolled in a compliant program.",
          "Making sure covered drivers are included in the correct random pool.",
          "Completing pre-employment testing and Clearinghouse steps before driving when required.",
          "Acting on testing notices and removing a prohibited driver from safety-sensitive work.",
          "Keeping required records and knowing which records the provider retains."
        ],
        callout: "Paying a consortium invoice is not the same as proving the entire program is compliant. Know what the provider handles and what remains with the company."
      },
      {
        heading: "What date belongs in a tracker",
        paragraphs: [
          "Federal rules do not create one universal annual consortium renewal date. The date comes from the provider's agreement or membership term.",
          "That provider date is still worth tracking because a missed payment or lapse can leave the carrier outside the program. We Heart Paperwork uses the date supplied by the consortium and keeps the separate annual Clearinghouse query under each driver."
        ]
      }
    ],
    faqs: [
      { question: "Does joining a consortium make the consortium responsible for everything?", answer: "No. A C/TPA performs the services the parties agreed on, but the employer remains responsible for compliance." },
      { question: "Does an owner-operator need a consortium?", answer: "An owner-operator subject to FMCSA drug and alcohol testing rules must participate in a random testing consortium and designate a C/TPA in the Clearinghouse." },
      { question: "Is consortium renewal an FMCSA annual deadline?", answer: "The program must remain compliant, but the membership renewal date itself is normally set by the provider." }
    ],
    related: [
      { slug: "clearinghouse-annual-query", label: "Clearinghouse annual query" },
      { slug: "driver-qualification-file", label: "Driver qualification file" },
      { slug: "dot-medical-card", label: "DOT medical qualification" }
    ],
    sources: [
      { label: "FMCSA — Consortium/Third-Party Administrators", url: "https://www.fmcsa.dot.gov/regulations/drug-alcohol-testing/what-are-consortiumthird-party-administrators" },
      { label: "FMCSA — Owner-Operator Drug and Alcohol Testing", url: "https://www.fmcsa.dot.gov/regulations/drug-alcohol-testing/owner-operator" },
      { label: "FMCSA Clearinghouse — Designating a C/TPA", url: "https://clearinghouse.fmcsa.dot.gov/content/resources/employer/Designate-CTPA.pdf" }
    ]
  },
  {
    slug: "fmcsa-portal-motus",
    eyebrow: "FMCSA REGISTRATION SYSTEM",
    title: "FMCSA Portal and Motus: Which System Do Carriers Use Now?",
    metaTitle: "FMCSA Portal vs. Motus: What Carriers Use Now",
    metaDescription: "See what moved to Motus, why the FMCSA Portal can still matter, and what account details carriers should keep current.",
    shortVersion: "Motus is FMCSA's current USDOT registration system. It uses Login.gov and now handles registration work such as biennial updates, company changes, authority actions, and USDOT status changes.",
    lastReviewed: "August 21, 2026",
    maintenanceNote: "Motus launched in May 2026 and FMCSA continues to release functionality. Check FMCSA's Motus pages before relying on an older set of instructions.",
    sections: [
      {
        heading: "What moved to Motus",
        paragraphs: [
          "FMCSA launched Motus: USDOT Registration System for motor carriers and other registrants in May 2026. Motus replaced the old registration workflow rather than the underlying responsibility to keep a USDOT record current.",
          "FMCSA lists biennial updates, business-information changes, operating-authority applications, reinstatements, and USDOT inactivation or reactivation among the actions available to registrants."
        ]
      },
      {
        heading: "Why the old Portal account still comes up",
        paragraphs: [
          "Motus uses Login.gov. FMCSA instructed existing carriers to use the same Login.gov email that was connected to the FMCSA Portal company-official account when claiming the company's USDOT number.",
          "Other FMCSA systems may still use Portal access. That is why We Heart Paperwork keeps Portal-access maintenance separate from the MCS-150 deadline itself."
        ],
        callout: "A login reminder is account maintenance, not a filing deadline. The actual compliance item is the registration or authority action you need to complete."
      },
      {
        heading: "What to keep straight",
        bullets: [
          "The Login.gov email tied to the authorized company official.",
          "Who is allowed to act for the company.",
          "Whether the USDOT number has been claimed in Motus.",
          "The next MCS-150 due date and any company information that has changed.",
          "Access to older FMCSA systems that still require the Portal."
        ]
      }
    ],
    faqs: [
      { question: "Is Motus live?", answer: "Yes. FMCSA launched Motus for registrants in May 2026." },
      { question: "Do I still file an MCS-150?", answer: "The biennial-update obligation remains. Motus changes the registration workflow used to complete and manage the update." },
      { question: "Should I use a new Login.gov email?", answer: "FMCSA tells existing carriers to use the same Login.gov email previously tied to the Portal company official so the carrier data can be claimed correctly." }
    ],
    related: [
      { slug: "mcs-150-biennial-update", label: "MCS-150 update" },
      { slug: "boc-3-process-agent", label: "BOC-3 process agent" },
      { slug: "motor-carrier-insurance", label: "Motor-carrier insurance" }
    ],
    sources: [
      { label: "FMCSA — Move Into Motus", url: "https://www.fmcsa.dot.gov/registration/move-motus" },
      { label: "FMCSA — Registration Modernization Updates", url: "https://www.fmcsa.dot.gov/registration/connect" },
      { label: "FMCSA — Motus Launch Announcement", url: "https://www.fmcsa.dot.gov/newsroom/trumps-transportation-secretary-sean-p-duffy-launches-new-anti-fraud-registration-system" }
    ]
  },
  {
    slug: "irp-apportioned-registration",
    eyebrow: "FLEET REGISTRATION",
    title: "IRP Apportioned Registration: What Date Should a Carrier Track?",
    metaTitle: "IRP Renewal: What Interstate Carriers Should Track",
    metaDescription: "Understand IRP apportioned registration, who generally needs it, why renewal dates vary, and what belongs in a carrier deadline tracker.",
    shortVersion: "IRP apportioned registration lets qualifying vehicles operate in multiple member jurisdictions under credentials issued by a base jurisdiction. The renewal date comes from that jurisdiction.",
    lastReviewed: "August 21, 2026",
    sections: [
      {
        heading: "What IRP handles",
        paragraphs: [
          "The International Registration Plan apportions commercial-vehicle registration fees among member jurisdictions. A carrier works through its base jurisdiction instead of buying a full annual registration in every jurisdiction where a qualifying vehicle operates.",
          "IRP and IFTA are often discussed together, but they are not the same. IRP handles registration fees. IFTA handles fuel-tax reporting."
        ]
      },
      {
        heading: "There is no single national renewal date",
        paragraphs: [
          "The base jurisdiction controls the account's renewal schedule, forms, mileage reporting, and credential process. The correct tracker date is the actual expiration or filing date shown by the base jurisdiction—not a date guessed from the day the carrier paid.",
          "We Heart Paperwork keeps the company IRP renewal visible and also lets each truck or trailer carry its own registration expiration. Those dates may be related, but they answer different questions."
        ]
      },
      {
        heading: "What to have ready",
        bullets: [
          "The base jurisdiction's renewal notice and deadline.",
          "Current fleet and vehicle information.",
          "Distance records for the reporting period required by the jurisdiction.",
          "Proof of payment and the current cab card for each apportioned vehicle.",
          "Any vehicle added, sold, or removed since the last filing."
        ]
      }
    ],
    faqs: [
      { question: "Is IRP the same as IFTA?", answer: "No. IRP concerns apportioned vehicle registration. IFTA concerns fuel-tax licensing and quarterly returns." },
      { question: "Does every interstate vehicle need IRP?", answer: "No. Applicability depends on the vehicle and operation. A carrier that is not apportioned may use another registration or permit arrangement." },
      { question: "What date should I enter?", answer: "Use the actual renewal or expiration date supplied by the base jurisdiction." }
    ],
    related: [
      { slug: "ifta-filing", label: "IFTA filing" },
      { slug: "annual-dot-inspection", label: "Annual DOT inspection" },
      { slug: "form-2290-hvut", label: "Form 2290" }
    ],
    sources: [
      { label: "International Registration Plan, Inc.", url: "https://www.irponline.org/" },
      { label: "FMCSA — Vehicle and Driver Inspection Documents", url: "https://www.fmcsa.dot.gov/international-programs/are-you-ready-vehicle-andor-driver-inspection-visor-card" }
    ]
  },
  {
    slug: "motor-carrier-insurance",
    eyebrow: "FINANCIAL RESPONSIBILITY",
    title: "Motor Carrier Insurance: What FMCSA Tracks and What the Carrier Should Watch",
    metaTitle: "FMCSA Motor Carrier Insurance: What to Track",
    metaDescription: "Learn how FMCSA insurance filings differ from the policy expiration date and what a small carrier should verify before coverage renews.",
    shortVersion: "FMCSA insurance filings and the carrier's insurance policy are connected, but they are not the same record. The insurer makes the federal filing; the carrier should track the real policy expiration and verify continuous coverage.",
    lastReviewed: "August 21, 2026",
    sections: [
      {
        heading: "The policy and the FMCSA filing are different records",
        paragraphs: [
          "A commercial auto policy is the insurance contract issued to the carrier. When federal operating authority requires proof of financial responsibility, the insurance company or another registered financial-responsibility filer submits the applicable filing to FMCSA.",
          "FMCSA says requirements vary by entity type, authority, cargo, and vehicle type. That is why a generic software card should not guess the required coverage amount."
        ]
      },
      {
        heading: "What the carrier should track",
        bullets: [
          "The expiration date on the current commercial auto policy.",
          "The vehicles that are scheduled or otherwise covered by the policy.",
          "The legal company name and address used by the insurer and FMCSA.",
          "Whether the required federal filing remains on record.",
          "Any cancellation or replacement notice and its effective date."
        ],
        callout: "The company policy expiration is the useful countdown. Vehicle records help identify the equipment, but they do not need a second copy of the same policy clock."
      },
      {
        heading: "Why a lapse matters",
        paragraphs: [
          "FMCSA requires applicable entities to maintain proof of insurance and process-agent designations on file to avoid revocation proceedings. A carrier should not assume that paying an invoice automatically means every federal record and every vehicle change is correct.",
          "Before renewal, confirm the policy, covered equipment, and FMCSA record with the insurer or agent."
        ]
      }
    ],
    faqs: [
      { question: "Does the carrier file its own proof of insurance with FMCSA?", answer: "Normally no. The insurance company or another registered filer submits the applicable federal insurance form." },
      { question: "Is general liability the same as commercial auto liability?", answer: "No. They cover different risks. The app's compliance countdown is intended for the commercial auto policy tied to the carrier's operation." },
      { question: "Should every truck have a separate expiration date?", answer: "Not when the equipment is covered under one policy with one expiration. Track the policy once and separately verify which vehicles are included." }
    ],
    related: [
      { slug: "boc-3-process-agent", label: "BOC-3 process agent" },
      { slug: "irp-apportioned-registration", label: "IRP registration" },
      { slug: "fmcsa-portal-motus", label: "FMCSA Portal and Motus" }
    ],
    sources: [
      { label: "FMCSA — Insurance Filing Requirements", url: "https://www.fmcsa.dot.gov/registration/insurance-filing-requirements" },
      { label: "eCFR — 49 CFR Part 387", url: "https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-387" }
    ]
  },
  {
    slug: "annual-dot-inspection",
    eyebrow: "FLEET COMPLIANCE",
    title: "Annual DOT Inspection: Trucks, Trailers, Due Dates, and Records",
    metaTitle: "Annual DOT Inspection: Trucks, Trailers & Records",
    metaDescription: "Learn the 12-month periodic inspection rule, how it applies to trailers, what proof stays with the vehicle, and how long to keep the report.",
    shortVersion: "Every commercial vehicle, including each segment of a combination vehicle, must receive a qualifying periodic inspection at least once every 12 months. That includes the trailer.",
    lastReviewed: "August 21, 2026",
    sections: [
      {
        heading: "The truck and trailer each have their own clock",
        paragraphs: [
          "FMCSA requires a periodic inspection at least once every 12 months for every commercial vehicle. Each segment of a combination vehicle is covered, so a tractor's current inspection does not make the trailer current.",
          "This is why the Fleet tab keeps the inspection date on each truck and each trailer instead of placing one annual inspection date on the company."
        ]
      },
      {
        heading: "What happens when the inspection is completed",
        paragraphs: [
          "The next deadline rolls from the date the new inspection was completed. If a truck is inspected on August 20, 2026, the next tracked date becomes August 20, 2027.",
          "The motor carrier must retain the periodic inspection report for 14 months. Documentation of the most recent inspection—such as the report, sticker, or decal—must be kept on the vehicle."
        ],
        callout: "A sticker is evidence of the inspection. It does not replace the carrier's copy of the actual periodic inspection report."
      },
      {
        heading: "What this tracker does not replace",
        bullets: [
          "Pre-trip inspection responsibilities.",
          "Defect reporting and repair certification.",
          "Systematic maintenance records.",
          "Inspector-qualification requirements.",
          "Roadside inspection responses."
        ],
        paragraphs: [
          "Those are operational maintenance and safety workflows. We Heart Paperwork tracks the recurring periodic-inspection date and its completion history."
        ]
      }
    ],
    faqs: [
      { question: "Does the trailer need its own annual inspection?", answer: "Yes. FMCSA applies the periodic inspection requirement to each segment of a combination vehicle." },
      { question: "How long do I keep the inspection report?", answer: "The carrier must retain the periodic inspection report for 14 months from the report date." },
      { question: "Does the next date run from the old expiration or the completion date?", answer: "The new inspection establishes the new 12-month cycle, so the tracker rolls from the actual completion date." }
    ],
    related: [
      { slug: "irp-apportioned-registration", label: "IRP registration" },
      { slug: "motor-carrier-insurance", label: "Motor-carrier insurance" },
      { slug: "form-2290-hvut", label: "Form 2290" }
    ],
    sources: [
      { label: "FMCSA Safety Planner — Periodic Inspection", url: "https://csa.fmcsa.dot.gov/SafetyPlanner/MyFiles/SubSections.aspx?ch=22&eta=101029&sec=65&sub=148" },
      { label: "eCFR — 49 CFR 396.17", url: "https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-396/section-396.17" },
      { label: "FMCSA — Inspection, Repair, and Maintenance", url: "https://www.fmcsa.dot.gov/safety/passenger-safety/inspection-repair-and-maintenance-motor-carriers-passengers-part-396" }
    ]
  }
];
