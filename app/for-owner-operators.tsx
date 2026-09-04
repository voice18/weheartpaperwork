import EditorialPage from "../components/public/EditorialPage";

export default function ForOwnerOperatorsPage() {
  return (
    <EditorialPage
      title="DOT Compliance Tracker for Owner-Operators"
      description="A simple DOT compliance tracker for owner-operators who file their own paperwork and need company, driver, truck, and trailer deadlines in one place."
      canonical="https://weheartpaperwork.com/for-owner-operators"
      eyebrow="BUILT FOR SMALL CARRIERS"
      heading="You can handle your own paperwork. You should not have to hold every date in your head."
      intro="We Heart Paperwork was built inside a trucking company for the person who owns the truck, drives the truck, handles the office, and still has to remember what expires next."
      sections={[
        {
          heading: "The problem is usually not knowing how to file",
          paragraphs: [
            "An owner-operator may already know where to renew UCR, file Form 2290, submit an IFTA return, or call about insurance. The problem is that those dates share the calendar with dispatch, repairs, customers, home time, and everything else.",
            "A missed deadline can cost more than the software used to track it. One late IFTA return carries a minimum $50 penalty under the IFTA agreement. An owner-operator with one active driver pays $3 a month for We Heart Paperwork."
          ]
        },
        {
          heading: "One company, one driver, one truck is still several clocks",
          bullets: [
            "MCS-150 biennial update and company changes.",
            "UCR, Form 2290, annual IFTA credentials, and quarterly IFTA returns.",
            "IRP, insurance, drug-and-alcohol program enrollment, and FMCSA account access.",
            "CDL, medical qualification, annual MVR, and annual Clearinghouse query.",
            "Truck and trailer registration and annual DOT inspection."
          ],
          callout: "Small fleet does not mean small paperwork. It means fewer people available to catch the mistake."
        },
        {
          heading: "What stays simple",
          paragraphs: [
            "The app is not an ELD, maintenance system, dispatch board, or managed compliance service. It stays focused on dates, status, setup confirmations, reminders, and history.",
            "Requirements that do not apply can be turned off. Sold equipment can be removed from active reminders without losing its record. Drivers and vehicles stay separated so the date always belongs to the right person or unit."
          ]
        },
        {
          heading: "What you still do",
          paragraphs: [
            "You verify which rules apply, complete the filing or renewal, retain the actual supporting documents, and make the compliance decisions. We Heart Paperwork keeps the work visible and records when you completed it.",
            "If you want somebody else to file, advise, and represent the company, choose a full-service provider. If you want to manage it yourself without running the business from memory, this was built for you."
          ]
        }
      ]}
      links={[
        { label: "Service or tracker?", href: "/compliance-service-or-tracker" },
        { label: "See pricing", href: "/pricing" },
        { label: "Free MCS-150 calculator", href: "/tools/mcs-150-due-date-calculator" }
      ]}
      sources={[
        { label: "IFTA, Inc. — Carrier Information", url: "https://www.iftach.org/carriers/" },
        { label: "FMCSA — Motor Carrier Safety Planner", url: "https://csa.fmcsa.dot.gov/SafetyPlanner/" }
      ]}
    />
  );
}
