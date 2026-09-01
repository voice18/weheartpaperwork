export type ComplianceGuideCategory =
  | "company"
  | "driver";

export type ComplianceGuideEntryId =
  | "mcs150"
  | "tax2290"
  | "fmcsa-portal"
  | "ucr"
  | "ifta"
  | "ifta-quarterly"
  | "irp"
  | "drug"
  | "boc3"
  | "cdl"
  | "medical"
  | "mvr"
  | "clearinghouse"
  | "dq";

export type ComplianceGuideSource = {
  label: string;
  url: string;
};

export type ComplianceGuideEntry = {
  id: ComplianceGuideEntryId;
  category: ComplianceGuideCategory;

  title: string;
  shortTitle: string;
  iconText: string;

  summary: string;

  whatItIs: string;
  whatYouEnter: string;
  howItWorks: string;
  markComplete: string;
  notifications: string;
  history: string;
  helpfulToKnow: string;

  sources: ComplianceGuideSource[];
};

export const COMPLIANCE_GUIDE_DISCLAIMER =
  "We Heart Paperwork helps organize compliance information and deadlines. It does not replace official agency guidance or professional legal, tax, or compliance advice.";

export const complianceGuideEntries: ComplianceGuideEntry[] = [
  {
    id: "mcs150",
    category: "company",

    title: "MCS-150 / USDOT Biennial Update",
    shortTitle: "MCS-150",
    iconText: "MCS",

    summary:
      "Track the FMCSA registration update cycle connected to your USDOT number.",

    whatItIs:
      "FMCSA requires entities with a USDOT number to keep registration information current and complete a biennial update every two years according to the USDOT-number filing schedule.",

    whatYouEnter:
      "The dashboard tracks the next scheduled MCS-150 due date. We Heart Paperwork can calculate the normal biennial due date from your USDOT number.",

    howItWorks:
      "The scheduled month comes from the last digit of the USDOT number, and the odd/even filing year comes from the next-to-last digit. Company information changes must also be reported within 30 days. An update filed during the 12 months before the scheduled biennial due date can satisfy that biennial cycle.",

    markComplete:
      "When you mark an MCS-150 update complete, the app records the filing date. If that filing falls within the 12-month window before the scheduled biennial deadline, the tracker advances to the next two-year cycle. An earlier filing outside that window does not move the scheduled biennial deadline.",

    notifications:
      "For an active MCS-150 deadline, We Heart Paperwork can send reminders 15 days before, 5 days before, and on the tracked due date.",

    history:
      "A completed update is stored in Compliance History with the completion date and the previous and next tracked due dates so the newest completion can be reversed safely.",

    helpfulToKnow:
      "The biennial schedule and the requirement to report company-information changes are related but different obligations. Filing an early company change does not automatically reset the biennial schedule.",

    sources: [
      {
        label: "FMCSA - Updating Your Registration or Authority",
        url: "https://www.fmcsa.dot.gov/registration/updating-your-registration",
      },
    ],
  },

  {
    id: "tax2290",
    category: "company",

    title: "Form 2290 Heavy Vehicle Use Tax",
    shortTitle: "2290",
    iconText: "2290",

    summary:
      "Track the normal annual Form 2290 deadline for a July-use fleet.",

    whatItIs:
      "Form 2290 is the federal Heavy Highway Vehicle Use Tax return for taxable heavy highway vehicles.",

    whatYouEnter:
      "For the standard annual tracker, you generally do not need to create your own annual due date. We Heart Paperwork uses August 31 for vehicles first used on public highways in July.",

    howItWorks:
      "The main company tracker follows a fixed annual August 31 cycle. It does not turn the filing date into a new anniversary date.",

    markComplete:
      "Marking the annual cycle complete records the completion in history and advances the tracker to August 31 of the following year.",

    notifications:
      "For the annual tracked deadline, We Heart Paperwork can send reminders 15 days before, 5 days before, and on the due date.",

    history:
      "Each completed annual cycle is stored in Compliance History. Reversing the newest completion can restore the previous annual due date.",

    helpfulToKnow:
      "A taxable vehicle first used after July can have a separate Form 2290 deadline, generally the last day of the month following the month of first use. The single annual company tracker is designed for the normal July-use fleet cycle and does not replace tracking a later first-use filing when one occurs.",

    sources: [
      {
        label: "IRS - Trucking Tax Center",
        url: "https://www.irs.gov/businesses/small-businesses-self-employed/trucking-tax-center",
      },
      {
        label: "IRS - When Form 2290 Taxes Are Due",
        url: "https://www.irs.gov/businesses/small-businesses-self-employed/when-form-2290-taxes-are-due",
      },
    ],
  },

  {
    id: "fmcsa-portal",
    category: "company",

    title: "FMCSA Portal Account Access",
    shortTitle: "Portal",
    iconText: "P90",

    summary:
      "Track Portal inactivity so access is not unexpectedly disabled.",

    whatItIs:
      "FMCSA advises users to log in to the FMCSA Portal at least every 90 days. Portal accounts can be disabled after 90 days and archived after 12 months of inactivity.",

    whatYouEnter:
      "Enter the date you last successfully logged in to the FMCSA Portal.",

    howItWorks:
      "We Heart Paperwork adds 90 days to the last login date and displays that as the next Portal-access maintenance date.",

    markComplete:
      "After you log in to the Portal, mark the item complete using the date of that login. The next tracked date becomes 90 days later.",

    notifications:
      "Portal maintenance intentionally uses a lighter reminder policy: 5 days before and on the tracked 90-day date.",

    history:
      "Completed Portal login events can be recorded in Compliance History so the most recent maintenance action is documented.",

    helpfulToKnow:
      "FMCSA registration systems are changing, including the transition to Motus. Portal access can still matter for FMCSA systems even when a particular registration action moves elsewhere.",

    sources: [
      {
        label: "FMCSA - Portal Account Inactivity Guidance",
        url: "https://www.fmcsa.dot.gov/newsroom/important-steps-you-must-take-prepare-fmcsas-new-registration-system",
      },
    ],
  },

  {
    id: "ucr",
    category: "company",

    title: "Unified Carrier Registration",
    shortTitle: "UCR",
    iconText: "UCR",

    summary:
      "Track the annual UCR registration cycle before the new registration year begins.",

    whatItIs:
      "Entities subject to the Unified Carrier Registration Plan register annually and pay the applicable UCR fee.",

    whatYouEnter:
      "The dashboard uses December 31 as the annual deadline marker for the upcoming registration year. You do not create a new anniversary based on the day you renew.",

    howItWorks:
      "UCR is treated as a fixed-calendar annual requirement. Completing it early does not pull next year's deadline forward.",

    markComplete:
      "Marking UCR complete records the completion and advances the tracked due date to December 31 of the next annual cycle.",

    notifications:
      "We Heart Paperwork can send reminders 15 days before, 5 days before, and on the tracked UCR deadline.",

    history:
      "Each completed annual cycle is stored in Compliance History. The newest completion can be reversed to restore the previous annual due date.",

    helpfulToKnow:
      "UCR fees are based on the applicable fleet-size bracket. The official UCR system remains the source of truth for registration and fees.",

    sources: [
      {
        label: "UCR Plan - Fee Brackets and Annual Registration",
        url: "https://plan.ucr.gov/fee-brackets/",
      },
      {
        label: "Official UCR Registration System",
        url: "https://www.ucr.gov/",
      },
    ],
  },

  {
    id: "ifta",
    category: "company",

    title: "IFTA License and Decals",
    shortTitle: "IFTA",
    iconText: "IFTA",

    summary:
      "Track the annual IFTA license and decal renewal separately from quarterly fuel-tax returns.",

    whatItIs:
      "IFTA provides qualified interstate motor carriers with credentials issued through their base jurisdiction and a system for reporting fuel-use taxes among participating jurisdictions.",

    whatYouEnter:
      "The annual company tracker uses December 31 as the end-of-year license and decal cycle. Your base jurisdiction remains the source of truth for the actual renewal process.",

    howItWorks:
      "The tracker is fixed to the annual calendar cycle. It does not create a new annual anniversary from the date you happen to renew.",

    markComplete:
      "Marking the annual IFTA license and decal renewal complete records the completion and advances the tracker to December 31 of the next year.",

    notifications:
      "We Heart Paperwork can send reminders 15 days before, 5 days before, and on the tracked annual renewal deadline.",

    history:
      "Annual license and decal renewals can be retained in Compliance History and the newest completion can be reversed safely.",

    helpfulToKnow:
      "This tracker is for the annual IFTA license and decals. Use the separate IFTA Quarterly tracker for fuel-tax return deadlines.",

    sources: [
      {
        label: "IFTA, Inc. - Carrier Information",
        url: "https://www.iftach.org/carriers/",
      },
    ],
  },

  {
    id: "ifta-quarterly",
    category: "company",

    title: "IFTA Quarterly Fuel Tax Return",
    shortTitle: "IFTA Quarterly",
    iconText: "QTR",

    summary:
      "Track the four quarterly IFTA fuel-tax return deadlines separately from annual license renewal.",

    whatItIs:
      "Carriers operating qualified motor vehicles in more than one IFTA jurisdiction generally report mileage and fuel activity to their base jurisdiction each quarter. The reporting quarter closes first; the return is normally due the following month.",

    whatYouEnter:
      "The app supplies the normal quarterly due dates: April 30, July 31, October 31, and January 31.",

    howItWorks:
      "This is a fixed quarterly filing calendar. January–March activity is due April 30, April–June is due July 31, July–September is due October 31, and October–December is due January 31. The tracker displays the quarter end for context, but notifications follow the filing due date. It applies to IFTA licensees, while an intrastate-only carrier can mark the requirement Does not apply.",

    markComplete:
      "Marking a return complete records that quarter in history and advances the tracker to the next quarterly due date.",

    notifications:
      "Quarterly IFTA uses a lighter reminder schedule: 5 days before and on the filing due date—not when the reporting quarter closes.",

    history:
      "Each completed quarter is retained in Compliance History with its previous and next due dates.",

    helpfulToKnow:
      "A base jurisdiction may require an IFTA return even when no taxable travel occurred during the quarter. Follow your base jurisdiction's instructions when a normal deadline falls on a weekend or holiday.",

    sources: [
      {
        label: "IFTA, Inc. - Carrier Information",
        url: "https://www.iftach.org/carriers/",
      },
    ],
  },

  {
    id: "irp",
    category: "company",

    title: "IRP Apportioned Registration",
    shortTitle: "IRP",
    iconText: "IRP",

    summary:
      "Track the actual renewal or expiration date for apportioned registration.",

    whatItIs:
      "The International Registration Plan provides apportioned registration for qualifying vehicles operating in multiple member jurisdictions.",

    whatYouEnter:
      "Enter the actual IRP expiration or renewal due date shown by your base jurisdiction or registration credentials.",

    howItWorks:
      "IRP is treated as an anchored annual due date. The app uses the date you provide rather than assuming one universal national renewal date.",

    markComplete:
      "When the current IRP cycle is completed, the next tracked due date advances one year from the existing due date rather than from the day you happened to complete the renewal.",

    notifications:
      "We Heart Paperwork can send reminders 15 days before, 5 days before, and on the tracked IRP due date.",

    history:
      "Each completed renewal can be stored in Compliance History with the previous and next due dates.",

    helpfulToKnow:
      "IRP renewal dates and procedures are jurisdiction-specific. Always use the date provided by your base jurisdiction.",

    sources: [
      {
        label: "International Registration Plan, Inc.",
        url: "https://www.irponline.org/",
      },
    ],
  },

  {
    id: "drug",
    category: "company",

    title: "Drug and Alcohol Consortium",
    shortTitle: "Consortium",
    iconText: "D&A",

    summary:
      "Track the provider-specific renewal date for your drug and alcohol testing program.",

    whatItIs:
      "DOT-regulated employers must maintain a compliant drug and alcohol testing program. Owner-operators and certain single-driver employers must participate through a consortium/third-party administrator for random testing.",

    whatYouEnter:
      "Enter the annual membership or renewal due date given to you by your consortium or testing provider.",

    howItWorks:
      "The app tracks the provider date you enter. FMCSA requires compliant program participation, but the subscription or membership renewal date itself comes from your provider.",

    markComplete:
      "When you complete a provider renewal, the tracker advances one year from the existing provider due date so completing early does not shorten the next cycle.",

    notifications:
      "We Heart Paperwork can send reminders 15 days before, 5 days before, and on the tracked provider renewal date.",

    history:
      "Completed renewals can be recorded in Compliance History with their previous and next tracked dates.",

    helpfulToKnow:
      "Using a consortium does not transfer the motor carrier's overall responsibility for compliance. Owner-operators have specific C/TPA requirements, including Clearinghouse responsibilities.",

    sources: [
      {
        label: "FMCSA - Consortium/Third-Party Administrators",
        url: "https://www.fmcsa.dot.gov/regulations/drug-alcohol-testing/what-are-consortiumthird-party-administrators",
      },
      {
        label: "FMCSA - Owner-Operator Drug and Alcohol Testing",
        url: "https://www.fmcsa.dot.gov/regulations/drug-alcohol-testing/owner-operator",
      },
    ],
  },

  {
    id: "boc3",
    category: "company",

    title: "BOC-3 Process Agent Filing",
    shortTitle: "BOC-3",
    iconText: "BOC",

    summary:
      "Confirm that the required process-agent designation remains valid.",

    whatItIs:
      "Form BOC-3 identifies process agents who can receive legal process on behalf of a motor carrier, broker, or freight forwarder when a designation is required.",

    whatYouEnter:
      "There is no recurring date to enter in the current tracker. You confirm that the BOC-3 requirement is satisfied and the designation remains valid.",

    howItWorks:
      "BOC-3 is treated as a one-time/status requirement rather than an annual countdown.",

    markComplete:
      "Marking BOC-3 complete records that you have confirmed the filing or designation. It stays complete unless circumstances require a new filing or you intentionally reverse the status.",

    notifications:
      "Because BOC-3 does not have a recurring due date in the app, it does not use the normal deadline reminder schedule.",

    history:
      "A confirmation can be stored in Compliance History. Reversing the newest confirmation can return the item to incomplete status.",

    helpfulToKnow:
      "A new filing can be necessary if the process-agent designation changes or becomes invalid. FMCSA can take action against operating authority when a required process-agent designation is not maintained.",

    sources: [
      {
        label: "FMCSA - Designation of Agents for Service of Process",
        url: "https://www.fmcsa.dot.gov/registration/process-agents",
      },
    ],
  },

  {
    id: "cdl",
    category: "driver",

    title: "CDL Expiration",
    shortTitle: "CDL",
    iconText: "CDL",

    summary:
      "Track the actual expiration date of a driver's commercial driver's license.",

    whatItIs:
      "Commercial driver's licenses are issued by State driver licensing agencies and allow qualified drivers to operate the classes of commercial motor vehicles covered by the credential.",

    whatYouEnter:
      "Enter the actual expiration date shown for the driver's current CDL.",

    howItWorks:
      "We Heart Paperwork tracks the exact expiration date you save. It does not calculate a new CDL expiration date or assume a standard license term.",

    markComplete:
      "CDL expiration is updated by saving the new expiration date from the renewed license. It does not use the recurring Mark Complete workflow used by MVR and Clearinghouse.",

    notifications:
      "We Heart Paperwork can send reminders 15 days before, 5 days before, and on the saved CDL expiration date.",

    history:
      "The current version saves the live CDL expiration date on the driver record. CDL date edits do not create the same completion-history records used by recurring MVR and Clearinghouse completions.",

    helpfulToKnow:
      "CDL issuance, renewal periods, and credential details are handled by State licensing agencies. Use the driver's actual State-issued credential as the source of truth.",

    sources: [
      {
        label: "FMCSA - Commercial Driver's License Program",
        url: "https://www.fmcsa.dot.gov/cdl",
      },
    ],
  },

  {
    id: "medical",
    category: "driver",

    title: "Medical Qualification Expiration",
    shortTitle: "Medical",
    iconText: "MED",

    summary:
      "Track the driver's actual medical qualification expiration date instead of assuming a two-year certificate.",

    whatItIs:
      "Commercial drivers subject to the medical qualification rules must maintain valid medical qualification information. Medical certification can be issued for less than the maximum certification period.",

    whatYouEnter:
      "Enter the actual medical certification expiration date shown in the driver's current medical qualification information.",

    howItWorks:
      "We Heart Paperwork treats the saved date as the real expiration date. It does not automatically add two years to the date of a physical examination.",

    markComplete:
      "When medical qualification is renewed, save the actual new expiration date. Mark Complete can record the renewal event in history, but the app does not invent the new expiration date from the completion date.",

    notifications:
      "We Heart Paperwork can send reminders 15 days before, 5 days before, and on the saved medical expiration date.",

    history:
      "A medical renewal completion can be recorded in Compliance History. If the newest history record is reversed, the previous saved value is restored only when the live value has not been manually changed afterward.",

    helpfulToKnow:
      "For CDL holders, medical qualification information is increasingly maintained through CDLIS and State driver records. Always use the driver's actual current medical qualification information.",

    sources: [
      {
        label: "FMCSA - Medical Requirements",
        url: "https://www.fmcsa.dot.gov/registration/commercial-drivers-license/medical",
      },
    ],
  },

  {
    id: "mvr",
    category: "driver",

    title: "Annual MVR Review",
    shortTitle: "Annual MVR",
    iconText: "MVR",

    summary:
      "Track the rolling annual review of each driver's motor vehicle record.",

    whatItIs:
      "Motor carriers must obtain and review an updated motor vehicle record for covered drivers at least once every 12 months and retain the required review documentation.",

    whatYouEnter:
      "Enter the date the driver's most recent annual MVR review was completed.",

    howItWorks:
      "We Heart Paperwork adds one year to the saved review date to calculate the next tracked annual due date.",

    markComplete:
      "When you complete the next annual review, Mark Complete saves that completion date as the new date of last review and calculates the next annual due date one year later.",

    notifications:
      "We Heart Paperwork can send reminders 15 days before, 5 days before, and on the calculated annual due date.",

    history:
      "Each Mark Complete action creates a Compliance History record containing the completion date and calculated next due date. Reversing the newest completion can restore the prior review date.",

    helpfulToKnow:
      "The review is more than simply possessing an MVR. The carrier must review the driving record and retain the required note documenting the review.",

    sources: [
      {
        label: "eCFR - 49 CFR 391.25 Annual Inquiry and Review of Driving Record",
        url: "https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-391/subpart-C/section-391.25",
      },
    ],
  },

  {
    id: "clearinghouse",
    category: "driver",

    title: "Clearinghouse Annual Query",
    shortTitle: "Clearinghouse",
    iconText: "CH",

    summary:
      "Track the rolling annual Clearinghouse query requirement for each employed CDL driver.",

    whatItIs:
      "Employers of CDL drivers must conduct a Clearinghouse query at least once per year for each CDL driver they employ.",

    whatYouEnter:
      "Enter the date the driver's most recent annual Clearinghouse query was completed.",

    howItWorks:
      "We Heart Paperwork adds one year to the saved query date to calculate the next tracked annual query date.",

    markComplete:
      "When the next annual query is completed, Mark Complete saves that completion date as the new date of last annual query and calculates the next date one year later.",

    notifications:
      "We Heart Paperwork can send reminders 15 days before, 5 days before, and on the calculated annual query date.",

    history:
      "Each completed annual query can be recorded in Compliance History. The newest completion can be reversed without overwriting a later manual edit.",

    helpfulToKnow:
      "This tracker is for the recurring annual employer query. Clearinghouse also has other requirements, including pre-employment queries and reporting obligations, that are not represented by this single annual date field.",

    sources: [
      {
        label: "FMCSA Clearinghouse - Query Requirements",
        url: "https://clearinghouse.fmcsa.dot.gov/query/plan",
      },
    ],
  },

  {
    id: "dq",
    category: "driver",

    title: "Driver Qualification File",
    shortTitle: "DQ File",
    iconText: "DQ",

    summary:
      "Understand the initial qualification records and the ongoing records that make up driver qualification compliance.",

    whatItIs:
      "Motor carriers must maintain a driver qualification file for each driver they employ. The file contains initial qualification records as well as required ongoing records.",

    whatYouEnter:
      "The current We Heart Paperwork checklist confirms whether the employment application, initial 3-year MVR records, road test certificate or permitted equivalent, applicable SPE or medical variance documentation, and applicable LCV training certificate have been addressed.",

    howItWorks:
      "The DQ checklist is a setup and organization tool. Items such as annual MVR review and medical expiration remain in Ongoing Driver Compliance so they can use their own date tracking and reminders.",

    markComplete:
      "DQ checklist rows are status confirmations rather than recurring Mark Complete deadlines. Conditional items can be identified as on file, missing, or not applicable where appropriate.",

    notifications:
      "The DQ checklist itself does not send deadline notifications. Recurring driver requirements such as medical expiration and annual MVR use their separate date-based reminders.",

    history:
      "The DQ checklist stores the current confirmation state. Recurring MVR, medical, and Clearinghouse events use their own compliance-history workflows.",

    helpfulToKnow:
      "Previous-employer safety-performance investigation records are tracked separately in the app because federal rules require those investigation records to be maintained in a separate driver investigation history file with controlled access.",

    sources: [
      {
        label: "eCFR - 49 CFR 391.51 Driver Qualification Files",
        url: "https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-391/subpart-F/section-391.51",
      },
      {
        label: "eCFR - 49 CFR 391.53 Driver Investigation History File",
        url: "https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-391/subpart-F/section-391.53",
      },
    ],
  },
];

export const companyGuideEntries =
  complianceGuideEntries.filter(
    entry => entry.category === "company"
  );

export const driverGuideEntries =
  complianceGuideEntries.filter(
    entry => entry.category === "driver"
  );

export function getComplianceGuideEntry(
  id: ComplianceGuideEntryId
): ComplianceGuideEntry | undefined {
  return complianceGuideEntries.find(
    entry => entry.id === id
  );
}
