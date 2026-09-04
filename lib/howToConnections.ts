type GuideLink = { label: string; href: string };

export type HowToConnection = {
  prerequisites?: GuideLink[];
  stuck?: string;
  stuckLink?: { label: string; url: string };
};

export const howToConnections: Record<string, HowToConnection> = {
  "update-mcs-150-motus": {
    prerequisites: [{ label: "Set up and protect your Login.gov account", href: "/how-to/set-up-login-gov" }],
    stuck: "If Motus will not connect you to the company, stop before creating extra accounts or changing company information just to get through the screen. Confirm that you are using the Login.gov email associated with the correct company official, then use FMCSA's current registration support pathway for a company-access problem.",
    stuckLink: { label: "Open FMCSA registration support", url: "https://www.fmcsa.dot.gov/registration/ask-fmcsa" },
  },
  "set-up-clearinghouse": {
    prerequisites: [{ label: "Set up and protect your Login.gov account", href: "/how-to/set-up-login-gov" }],
    stuck: "Login.gov handles sign-in; the Clearinghouse handles the employer, driver, and C/TPA roles. If sign-in fails, use Login.gov support. If the account opens but the company or role is wrong, use the Clearinghouse employer help material before creating another account.",
    stuckLink: { label: "Open the Clearinghouse employer help center", url: "https://clearinghouse.fmcsa.dot.gov/Learn/Employer" },
  },
  "run-annual-clearinghouse-query": {
    prerequisites: [{ label: "Set up the employer Clearinghouse account", href: "/how-to/set-up-clearinghouse" }],
    stuck: "A query marked pending driver consent is not complete. For a full query, the driver must sign in and provide specific electronic consent. A limited annual query uses general consent obtained outside the Clearinghouse; if it returns records found, follow the Clearinghouse instructions for the required full query.",
    stuckLink: { label: "Review official query and consent guidance", url: "https://clearinghouse.fmcsa.dot.gov/query/plan" },
  },
  "enroll-drug-alcohol-consortium": {
    prerequisites: [{ label: "Set up the employer Clearinghouse account", href: "/how-to/set-up-clearinghouse" }],
    stuck: "Enrollment, Clearinghouse designation, and a completed pre-employment test are separate confirmations. Ask the provider for the effective enrollment date, the covered-driver roster, and exactly which Clearinghouse actions it will perform. Owner-operators must designate a C/TPA in the Clearinghouse.",
  },
  "build-driver-qualification-file": {
    prerequisites: [
      { label: "Get the driver's initial MVR", href: "/how-to/get-driver-mvr" },
      { label: "Set up the employer Clearinghouse account", href: "/how-to/set-up-clearinghouse" },
      { label: "Enroll in a drug and alcohol consortium", href: "/how-to/enroll-drug-alcohol-consortium" },
    ],
    stuck: "Do not wait for every outside record before organizing the file. Use the checklist to identify what is present, what has been requested, what is still missing, and which sensitive investigation or drug-and-alcohol records require separate access controls.",
  },
  "get-driver-mvr": {
    stuck: "There is no single federal MVR ordering portal. If the state page offers several record products, confirm that the record covers the driver's licensing history needed for the employer inquiry and follow that state's employer-authorization rules. Do not substitute an unofficial lookup because it is faster.",
    stuckLink: { label: "Find the official agency for the driver's state", url: "https://www.usa.gov/state-motor-vehicle-services" },
  },
  "complete-annual-mvr-review": {
    prerequisites: [{ label: "Get the driver's current MVR", href: "/how-to/get-driver-mvr" }],
    stuck: "The MVR and the carrier's review are two records. If the MVR conflicts with the license or shows a suspension, revocation, restriction, or possible disqualification, do not simply sign the review form. Verify the driver's current status before deciding that the driver remains qualified.",
  },
  "file-form-2290": {
    stuck: "A provider receipt is not the finished proof normally needed for registration. Confirm that the return was accepted and download the watermarked Schedule 1. If a VIN is wrong, follow the IRS or provider's VIN-correction process instead of filing a second ordinary return without checking.",
  },
  "complete-annual-dot-inspection": {
    stuck: "Ask the shop whether it performs the federal annual periodic inspection under 49 CFR 396.17 and whether it will provide a signed report identifying the vehicle, inspection date, inspector, and results. Confirm that you are scheduling the annual inspection—not only a roadside-style inspection or a general safety check.",
    stuckLink: { label: "Review FMCSA inspector qualifications", url: "https://csa.fmcsa.dot.gov/SafetyPlanner/GetFile.aspx?d=43" },
  },
  "renew-irp-registration": {
    stuck: "IRP requirements and portals come from the base jurisdiction. If a truck was added, sold, replaced, or changed weight groups during the period, do not assume the ordinary renewal list is enough. Use the base jurisdiction's instructions for fleet changes and keep the documents supporting additions and deletions.",
    stuckLink: { label: "Find your IRP jurisdiction", url: "https://www.irponline.org/search/custom.asp?id=373" },
  },
};
