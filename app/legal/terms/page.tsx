import LegalLayout from "@/components/layout/LegalLayout"

export default function TermsPage() {
  return (
    <LegalLayout
      kicker="Legal"
      title="Terms of Service"
      lastUpdated="May 2026"
      intro="These Terms govern your use of TicketPulse. By creating an account or buying a ticket, you agree to them. We've kept the language as plain as we can — but the legal effect is real."
      sections={[
        {
          id: "agreement", title: "Your agreement with us",
          body: <>
            <p>TicketPulse Zimbabwe (Pvt) Ltd (&ldquo;<strong>TicketPulse</strong>&rdquo;, &ldquo;<strong>we</strong>&rdquo;) operates the platform at ticketpulse.co.zw. By accessing or using it, you (&ldquo;<strong>you</strong>&rdquo;) accept these Terms and our <a href="/legal/privacy">Privacy Policy</a>.</p>
            <p>If you do not agree, please do not use the service.</p>
          </>,
        },
        {
          id: "accounts", title: "Accounts and eligibility",
          body: <>
            <p>You must be at least 18, or have a parent/guardian&apos;s consent, to buy tickets. You agree to provide accurate information and keep your sign-in credentials private.</p>
            <ul>
              <li>You are responsible for activity under your account.</li>
              <li>We may suspend accounts that breach these Terms or that we reasonably believe are fraudulent.</li>
            </ul>
          </>,
        },
        {
          id: "tickets", title: "Tickets and entry",
          body: <>
            <p>A ticket is a license to attend the listed event under the organizer&apos;s rules. Entry is via the QR code attached to your account.</p>
            <ul>
              <li>Tickets may not be resold above face value without organizer consent.</li>
              <li>Unauthorized resale may void the ticket.</li>
              <li>The organizer — not TicketPulse — is responsible for delivering the event.</li>
            </ul>
          </>,
        },
        {
          id: "refunds", title: "Refunds and cancellations",
          body: <>
            <p>You may cancel and receive a full refund up to 24 hours before the event start time. After that, refunds are at the organizer&apos;s discretion.</p>
            <ul>
              <li>If an event is cancelled, refunds are processed automatically within 7 days.</li>
              <li>Refunds return to the original payment method.</li>
              <li>Booking fees of &lt; USD 1 are non-refundable on user-initiated cancellations.</li>
            </ul>
          </>,
        },
        {
          id: "fees", title: "Fees and payments",
          body: <>
            <p>For attendees, TicketPulse is free. We charge organizers a 5% platform fee on tickets sold. Vendors keep 95% of bookings made via the platform.</p>
            <p>Funds are processed by our payment partners and held in escrow with TrustCo Zimbabwe pending event completion. See <a href="/payouts">Payouts</a> for the full timeline.</p>
          </>,
        },
        {
          id: "organizer-obligations", title: "Organizer and vendor obligations",
          body: <>
            <p>Organizers must hold all permits required for their event and must clearly disclose age limits, refund rules, and venue policies. Vendors must hold any licenses required for their service category and deliver the package as described.</p>
            <p>TicketPulse may delist any organizer or vendor whose conduct breaches Zimbabwean law or these Terms.</p>
          </>,
        },
        {
          id: "liability", title: "Liability",
          body: <>
            <p>We provide the platform &ldquo;as is&rdquo;. To the maximum extent permitted by law, TicketPulse is not liable for indirect, incidental, or consequential losses, or for the conduct of organizers, vendors, or other users.</p>
            <p>Our total liability to you for any claim arising from these Terms is capped at the total fees you have paid us in the 12 months preceding the claim.</p>
          </>,
        },
        {
          id: "changes", title: "Changes",
          body: <>
            <p>We may update these Terms. Material changes will be flagged via email and on the platform. Continued use after a change means you accept the updated Terms.</p>
          </>,
        },
        {
          id: "law", title: "Governing law",
          body: <>
            <p>These Terms are governed by the laws of Zimbabwe. Disputes will be resolved in the courts of Harare, unless a binding small-claims venue applies.</p>
          </>,
        },
        {
          id: "contact", title: "Contact",
          body: <>
            <p>Questions about these Terms? Email <a href="mailto:legal@ticketpulse.co.zw">legal@ticketpulse.co.zw</a> or write to us at 3rd Floor, Building 4, Eastgate Centre, Harare.</p>
          </>,
        },
      ]}
    />
  )
}
