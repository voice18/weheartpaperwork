import EditorialPage from "../components/public/EditorialPage";

export default function ComplianceServiceOrTrackerPage() {
  return (
    <EditorialPage
      title="DOT Compliance Service or Tracker? | We Heart Paperwork"
      description="Decide whether your trucking company needs a managed DOT compliance service or a simple system for tracking deadlines and records."
      canonical="https://weheartpaperwork.com/compliance-service-or-tracker"
      eyebrow="CHOOSING THE RIGHT KIND OF HELP"
      heading="Do you need a compliance service, or just a system?"
      intro="Both can be useful. They solve different problems. The right choice depends on whether you want someone else to do the compliance work or you plan to handle it yourself."
      sections={[
        {
          heading: "Choose a full-service provider when you want the work handled",
          paragraphs: [
            "A managed compliance provider can file forms, build driver files, administer programs, answer questions, and help during an audit. The exact work depends on the contract and service level.",
            "That can be the right choice when nobody inside the company has the time or confidence to manage compliance. It also costs more because you are paying for people and service, not only software."
          ],
          bullets: [
            "You want someone else to prepare or file forms.",
            "You need ongoing compliance advice or audit support.",
            "Your operation has specialized passenger, hazmat, household-goods, or multi-state requirements.",
            "You do not have anyone available to own the paperwork."
          ]
        },
        {
          heading: "Choose a tracker when you can do the work but do not want to forget it",
          paragraphs: [
            "Many small carriers already know how to renew their registration, file IFTA, call the insurance agent, pull an MVR, or complete a Clearinghouse query. The hard part is keeping every date visible while trucks are moving and everything else is happening.",
            "A tracker does not make decisions or file on your behalf. It gives the person doing the work one place to see the next deadline and record that it was handled."
          ],
          bullets: [
            "You already manage your own DOT paperwork.",
            "You mainly need dates, reminders, status, and history.",
            "You want each driver, truck, and trailer clearly separated.",
            "You do not want to pay for services you will not use."
          ],
          callout: "We Heart Paperwork is the second option. You do the filing. The app keeps the clock and the record organized."
        },
        {
          heading: "What We Heart Paperwork does—and does not do",
          bullets: [
            "Tracks recurring company deadlines, including MCS-150, UCR, Form 2290, annual IFTA credentials, quarterly IFTA returns, IRP, insurance, consortium renewal, Portal access, and BOC-3 status.",
            "Tracks CDL, medical qualification, annual MVR, annual Clearinghouse queries, and driver onboarding confirmations.",
            "Tracks registration and annual DOT inspection dates for trucks and trailers.",
            "Does not file forms, manage ELD logs, run a maintenance shop, represent the carrier in an audit, or guarantee compliance."
          ]
        },
        {
          heading: "The simple test",
          paragraphs: [
            "Ask one question: if the app reminded you today, would you know how to complete the work? If the answer is yes, a tracker may be enough. If the answer is no and you want somebody responsible for doing it, look for a qualified full-service provider.",
            "There is no benefit in buying the bigger service simply because it has more features. There is also no benefit in buying a tracker when what you actually need is hands-on help."
          ]
        }
      ]}
      links={[
        { label: "See exactly what the app tracks", href: "/features" },
        { label: "Pricing", href: "/pricing" },
        { label: "Compliance guides", href: "/compliance" }
      ]}
    />
  );
}
