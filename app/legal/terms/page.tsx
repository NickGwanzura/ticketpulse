import LegalLayout from "@/components/layout/LegalLayout"

export const metadata = { title: "Terms of Service", alternates: { canonical: "/legal/terms" } }

export default function TermsPage() {
  return (
    <LegalLayout
      kicker="Legal"
      title="Terms of Service"
      lastUpdated="2 October 2026"
      intro="These terms explain how TicketPulse accounts, tickets, payments and organizer services work. Read them before creating an account or placing an order."
      sections={[
        {
          id: "agreement", title: "Your agreement with us",
          body: <>
            <p><strong>TicketPulse</strong> operates the platform at ticketpulse.tech. By creating an account or placing an order, you agree to these terms. Our <a href="/legal/privacy">Privacy Policy</a> explains how we handle personal information, and our <a href="/legal/cookies">Cookie Policy</a> explains browser storage and analytics choices.</p>
            <p>Choosing whether to allow optional analytics is separate from agreeing to these terms.</p>
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
            <p>A ticket gives access to the listed event under the organizer&apos;s rules. Check the event date, venue, age restrictions and ticket details before ordering. Entry is checked using your ticket QR code, available from your order or ticket delivery message.</p>
            <ul>
              <li>Tickets may not be resold above face value without organizer consent.</li>
              <li>Unauthorized resale may void the ticket.</li>
              <li>The organizer, not TicketPulse, is responsible for delivering the event.</li>
            </ul>
          </>,
        },
        {
          id: "refunds", title: "Refunds and cancellations",
          body: <>
            <p>Refund eligibility depends on the event&apos;s published refund rules, the reason for the request and applicable consumer rights. Contact <a href="/contact">TicketPulse support</a> with your order reference if you need to request a refund or report a cancellation.</p>
            <ul>
              <li>For cancelled or materially changed events, support will explain the available refund or replacement arrangements.</li>
              <li>Approved refunds are reconciled against the original order and payment. The payment provider can affect the available refund method and processing time.</li>
              <li>Do not submit another payment while an existing payment or refund is being checked.</li>
            </ul>
          </>,
        },
        {
          id: "fees", title: "Fees and payments",
          body: <>
            <p>The price, currency and any applicable charges are shown during checkout. Review the confirmed order total before authorizing payment. Payments are handled through our payment partners, including Velocity for supported EcoCash and card payments.</p>
            <p>The standard organizer platform fee is 6%, unless a different rate is shown for the event or agreed with TicketPulse. An organizer&apos;s payout balance accounts for confirmed revenue, platform fees, earlier payouts, pending requests and any refund adjustments.</p>
            <p>Payout requests are subject to TicketPulse review and the available balance. See the <a href="/help/organizers">organizer guide</a> and your <a href="/payouts">payout ledger</a>. Account trust levels reflect approval and paid payout history; they do not guarantee a payout processing time.</p>
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
            <p>These terms do not exclude or limit rights or liabilities that cannot lawfully be excluded or limited.</p>
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
            <p>For questions about these terms or an order, email <a href="mailto:nick@ticketpulse.tech">nick@ticketpulse.tech</a> or use our <a href="/contact">contact page</a>. Include your order or event reference when relevant.</p>
          </>,
        },
      ]}
    />
  )
}
