import LegalLayout from "@/components/layout/LegalLayout"

export default function PrivacyPage() {
  return (
    <LegalLayout
      kicker="Legal"
      title="Privacy Policy"
      lastUpdated="May 2026"
      intro="We collect what we need to deliver the service — and nothing more. Here's exactly what we hold, why, who sees it, and how to ask for it back."
      sections={[
        {
          id: "what",  title: "What we collect",
          body: <>
            <p>We hold three categories of data:</p>
            <ul>
              <li><strong>Account data</strong> — name, email, phone, city, role (attendee, organizer, vendor).</li>
              <li><strong>Transaction data</strong> — tickets bought/sold, payment method (last four digits only), refunds.</li>
              <li><strong>Usage data</strong> — pages viewed, IP address, device type, referrer (for fraud detection).</li>
            </ul>
            <p>We do not collect: sensitive identifiers (national ID), location beyond city, or biometric data.</p>
          </>,
        },
        {
          id: "why",   title: "Why we collect it",
          body: <>
            <ul>
              <li>To deliver the service: process payments, scan tickets, deliver photo packs.</li>
              <li>To keep the platform safe: detect fraud, abuse, and unauthorized access.</li>
              <li>To improve: aggregated, anonymous analytics inform product changes.</li>
              <li>To communicate: order receipts and (with consent) marketing.</li>
            </ul>
          </>,
        },
        {
          id: "shared", title: "Who we share with",
          body: <>
            <p>Limited and purposeful:</p>
            <ul>
              <li><strong>Organizers</strong> see attendee names and emails for the events you buy tickets to.</li>
              <li><strong>Vendors</strong> see contact details only after a booking is confirmed.</li>
              <li><strong>Payment processors</strong> (EcoCash, Paynow, Stripe-hosted card processing) handle the financial leg.</li>
              <li><strong>Authorities</strong>, where required by Zimbabwean law (e.g. fraud, terrorism investigations).</li>
            </ul>
            <p>We never sell your data to third parties.</p>
          </>,
        },
        {
          id: "retention", title: "How long we keep it",
          body: <>
            <ul>
              <li>Account data — until you delete your account, plus 30 days for backups.</li>
              <li>Transaction records — 7 years, as required by Zimbabwean tax law.</li>
              <li>Marketing preferences — until you opt out.</li>
            </ul>
          </>,
        },
        {
          id: "rights", title: "Your rights",
          body: <>
            <p>You can ask us to:</p>
            <ul>
              <li>Show you a copy of the data we hold about you.</li>
              <li>Correct anything inaccurate.</li>
              <li>Delete your account and personal data (we will retain transaction records as required).</li>
              <li>Stop sending marketing.</li>
            </ul>
            <p>Email <a href="mailto:privacy@ticketpulse.co.zw">privacy@ticketpulse.co.zw</a> and we will respond within 30 days.</p>
          </>,
        },
        {
          id: "security", title: "Security",
          body: <>
            <p>Data is encrypted in transit (TLS 1.3) and at rest. Payment data is tokenized — we never store card numbers. Access to production systems is limited and logged.</p>
            <p>If we ever experience a breach affecting your data, we will notify you within 72 hours.</p>
          </>,
        },
        {
          id: "cookies", title: "Cookies",
          body: <>
            <p>We use cookies for sign-in, fraud detection, and (with consent) analytics. See our <a href="/legal/cookies">Cookie Policy</a> for the full list.</p>
          </>,
        },
        {
          id: "children", title: "Children",
          body: <>
            <p>TicketPulse is not aimed at children under 13. We do not knowingly collect data from them. If we discover such data, we will delete it.</p>
          </>,
        },
        {
          id: "contact", title: "Contact",
          body: <>
            <p>For any privacy question, email <a href="mailto:privacy@ticketpulse.co.zw">privacy@ticketpulse.co.zw</a>.</p>
          </>,
        },
      ]}
    />
  )
}
