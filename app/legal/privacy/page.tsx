import LegalLayout from "@/components/layout/LegalLayout"

export const metadata = { title: "Privacy Policy", alternates: { canonical: "/legal/privacy" } }

export default function PrivacyPage() {
  return (
    <LegalLayout
      kicker="Legal"
      title="Privacy Policy"
      lastUpdated="2 October 2026"
      intro="This policy explains what TicketPulse collects when you browse, buy tickets or use organizer services, how that information is used, and how to contact us about your privacy."
      sections={[
        {
          id: "what", title: "Information we collect",
          body: <>
            <ul>
              <li><strong>Account and contact details:</strong> your name, email address, phone number, account role and profile information you provide.</li>
              <li><strong>Orders and tickets:</strong> event selections, ticket holders, order references, payment status, ticket delivery, transfers, check-ins, refunds and purchase history.</li>
              <li><strong>Payment and settlement details:</strong> the payment method, EcoCash number, transaction references and, for organizer bank payouts, the account holder, account number and bank name you submit. Card payments use a hosted payment provider; do not send full card details or PINs to TicketPulse support.</li>
              <li><strong>Content and messages:</strong> event or vendor information, uploaded images, reviews, support enquiries and answers to event booking questions.</li>
              <li><strong>Technical information:</strong> browser information, request logs and security information such as IP addresses. If you allow optional analytics, we also record event visits and checkout interactions linked to a random browser-session identifier.</li>
            </ul>
            <p>You provide information through forms and account activity. Payment providers also send transaction status and reference information needed to reconcile an order.</p>
          </>,
        },
        {
          id: "why", title: "How we use information",
          body: <>
            <ul>
              <li>To create accounts, process orders, deliver tickets and verify ticket entry.</li>
              <li>To contact you about an order, payment, event change, refund or support request, including by email or WhatsApp where those delivery features are used.</li>
              <li>To reconcile payments, calculate organizer revenue, review payouts and keep transaction and audit records.</li>
              <li>To prevent abuse, secure account and order access, and investigate failed payments or other service problems.</li>
              <li>To provide profiles, reviews, event listings and other features you choose to use.</li>
              <li>To understand browsing and checkout use when you allow optional analytics.</li>
            </ul>
            <p>Service messages are needed to fulfil an order or respond to a request. Optional analytics can be declined without preventing a purchase.</p>
          </>,
        },
        {
          id: "shared", title: "Who receives information",
          body: <>
            <ul>
              <li><strong>Organizers and authorized event staff:</strong> information needed to manage their events, attendee orders, booking answers and ticket entry.</li>
              <li><strong>Vendors:</strong> details needed to respond to an enquiry or provide a service you request.</li>
              <li><strong>Service providers:</strong> payment processing, hosting, database and file storage, email and messaging delivery, and other tools used to provide the features you request. Velocity handles supported EcoCash and card payment flows.</li>
              <li><strong>Public visitors:</strong> information you choose to publish in event listings, organizer or vendor profiles and reviews.</li>
              <li><strong>Authorities or other necessary recipients:</strong> where disclosure is legally required or needed to address fraud, a dispute or a security incident.</li>
            </ul>
            <p>Hosted payment providers and external services have their own privacy policies. We do not sell personal information.</p>
          </>,
        },
        {
          id: "storage", title: "Storage and retention",
          body: <>
            <p>We keep information for the service purposes described above, including handling orders, support, accounting, disputes and legal obligations. Retention depends on the record and the applicable obligation; deleting an account does not necessarily remove transaction or audit records that must still be kept.</p>
            <p>Some service providers may process information outside Zimbabwe. Privacy questions about those providers or your information can be sent to the contact below.</p>
            <p>Your browser also holds cart, order-access, checkout-recovery and preference information. You can clear browser storage yourself. Clearing it does not erase information already recorded in TicketPulse&apos;s systems.</p>
          </>,
        },
        {
          id: "choices", title: "Your privacy choices",
          body: <>
            <p>You can ask to access information about you, correct inaccurate details, request deletion where appropriate, or object to or withdraw consent for processing that relies on consent.</p>
            <p>Use <a href="/legal/cookies#manage">Cookie settings</a> to change optional analytics choices. To request help with other personal information, email <a href="mailto:nick@ticketpulse.tech">nick@ticketpulse.tech</a> or use our <a href="/contact">contact page</a>. We may need to verify your identity before disclosing or changing account or order information.</p>
            <p>You may also raise a data-protection concern with Zimbabwe&apos;s Postal and Telecommunications Regulatory Authority (POTRAZ), the authority designated in the <a href="https://www.potraz.gov.zw/wp-content/uploads/2022/02/Data-Protection-Act-5-of-2021.pdf" target="_blank" rel="noopener noreferrer">Data Protection Act</a>.</p>
          </>,
        },
        {
          id: "security", title: "Keeping information secure",
          body: <>
            <p>TicketPulse uses safeguards such as authenticated access, restricted order-access links and protected payment flows. Keep account credentials, guest order links and ticket QR codes private; someone with a valid ticket code may be able to present it at an event.</p>
            <p>No online service can guarantee complete security. Contact us promptly if you suspect someone has accessed your account or order without permission.</p>
          </>,
        },
        {
          id: "cookies", title: "Cookies and analytics",
          body: <>
            <p>Essential cookies and browser storage support sign-in, checkout and order access. Optional browser analytics are off until you choose Allow analytics and can be switched off using Cookie settings.</p>
            <p>Order, payment and check-in records are still kept to operate the service even if optional analytics are declined. Read the <a href="/legal/cookies">Cookie Policy</a> for details.</p>
          </>,
        },
        {
          id: "children", title: "Children and event restrictions",
          body: <p>Under-18 users should use TicketPulse with a parent or guardian&apos;s involvement. Event organizers set their own age and entry restrictions. A parent or guardian can contact us about information provided by a child.</p>,
        },
        {
          id: "contact", title: "Contact and updates",
          body: <>
            <p>Send privacy questions to <a href="mailto:nick@ticketpulse.tech">nick@ticketpulse.tech</a> or our <a href="/contact">contact page</a>. Include enough detail to identify the account, order or request, without sending passwords, payment PINs or full card details.</p>
            <p>We will update this page when our information practices change. The date above identifies the latest update.</p>
          </>,
        },
      ]}
    />
  )
}
