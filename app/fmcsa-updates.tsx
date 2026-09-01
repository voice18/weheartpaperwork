import EditorialPage from "../components/public/EditorialPage";

export default function FmcsaUpdatesPage() {
  return (
    <EditorialPage
      title="FMCSA Updates for Small Motor Carriers"
      description="Plain-English notes on FMCSA registration and compliance changes that affect small motor carriers, with dates and official sources."
      canonical="https://weheartpaperwork.com/fmcsa-updates"
      eyebrow="FMCSA UPDATES"
      heading="What changed, who it affects, and what to do next."
      intro="This is a running record of changes that affect the paperwork small carriers manage. We add an entry when there is a real change—not to fill a publishing calendar."
      reviewed="August 21, 2026"
      sections={[
        {
          heading: "May 19, 2026: Motus launches for motor carriers",
          paragraphs: [
            "FMCSA launched Motus: USDOT Registration System for motor carriers and other registrants. It replaced the old registration workflow for actions such as applying for a USDOT number or authority, filing a biennial update, changing company information, reinstating authority, and changing USDOT status.",
            "Existing carriers should use the same Login.gov email that was tied to the FMCSA Portal company official when claiming their USDOT number in Motus. FMCSA says the system uses identity verification and continues to receive added functionality."
          ],
          bullets: [
            "Who is affected: entities that create or maintain FMCSA registration records.",
            "What changed: the system used to perform registration work.",
            "What did not disappear: the underlying filing and update responsibilities.",
            "What to do: confirm the correct company official, Login.gov email, and Motus access before the next filing is due."
          ],
          callout: "We Heart Paperwork updated its MCS-150 and account-access language for Motus. The app still tracks the deadline; Motus is where the registration work is completed."
        },
        {
          heading: "How we maintain this page",
          paragraphs: [
            "Each entry must link to an official FMCSA, DOT, IRS, UCR, IFTA, IRP, State, or regulatory source. We state the effective date when one is available and separate an agency announcement from a rule that is already in force.",
            "If an older entry is superseded, we keep the history but add a clear note pointing to the current instruction. The Last reviewed date changes only when the page is actually checked or revised."
          ]
        },
        {
          heading: "Official sources for this update",
          paragraphs: [
            "The links below go directly to FMCSA's Motus instructions, registration-modernization updates, and launch announcement."
          ]
        }
      ]}
      links={[
        { label: "FMCSA Portal and Motus guide", href: "/compliance/fmcsa-portal-motus" },
        { label: "MCS-150 guide", href: "/compliance/mcs-150-biennial-update" },
        { label: "All compliance guides", href: "/compliance" }
      ]}
      sources={[
        { label: "FMCSA — Move Into Motus", url: "https://www.fmcsa.dot.gov/registration/move-motus" },
        { label: "FMCSA — Registration Modernization Updates", url: "https://www.fmcsa.dot.gov/registration/connect" },
        { label: "FMCSA — Motus Launch Announcement", url: "https://www.fmcsa.dot.gov/newsroom/trumps-transportation-secretary-sean-p-duffy-launches-new-anti-fraud-registration-system" }
      ]}
    />
  );
}
