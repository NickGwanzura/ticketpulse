import LegalLayout from "@/components/layout/LegalLayout"
import CookieSettingsButton from "@/components/CookieSettingsButton"

export const metadata = { title: "Cookie Policy", alternates: { canonical: "/legal/cookies" } }

export default function CookiesPage() {
  return (
    <LegalLayout
      kicker="Legal"
      title="Cookie Policy"
      lastUpdated="2 October 2026"
      intro="We use cookies and browser storage to run TicketPulse. Optional browser analytics stay off until you allow them. You can change that choice at any time."
      sections={[
        {
          id: "what", title: "Cookies and browser storage",
          body: <>
            <p>Cookies are small values a website stores in your browser and can send with requests. Local storage keeps information on this device across visits; session storage normally lasts for a browser tab or session.</p>
            <p>We use these technologies for sign-in, cart contents, order access, checkout recovery, preferences and optional analytics. Clearing them can sign you out or remove a saved cart. It does not cancel a recorded order or payment.</p>
          </>,
        },
        {
          id: "essential", title: "Essential storage",
          body: <>
            <p>Essential storage supports features you use and remains available when you choose Essential only.</p>
            <ul>
              <li><strong>Sign-in and security:</strong> Auth.js session, CSRF and callback cookies support authentication. Names can include secure prefixes depending on the site address. The session cookie has a default lifetime of up to 30 days and can be renewed by sign-in activity.</li>
              <li><strong>Access:</strong> the tp_access cookie remembers access to the launch area when that feature is enabled.</li>
              <li><strong>Cart and orders:</strong> tp_cart, tp_orders and tp_order_access in local storage retain your cart, recent orders and proof of access to guest orders until changed or cleared.</li>
              <li><strong>Checkout recovery:</strong> session storage holds a checkout request reference, payment-checking state and contact details you entered so the same tab can recover after a refresh.</li>
              <li><strong>Your cookie choice:</strong> tp_cookie_preferences_v1 in local storage records whether you allow optional analytics. We use that choice for 180 days unless you change or clear it earlier.</li>
            </ul>
          </>,
        },
        {
          id: "preferences", title: "Feature preferences",
          body: <>
            <p>When you use features such as theme selection, saved events or table settings, TicketPulse can remember those choices in local storage. Examples include ticketpulse-theme and tp:favourites. These preferences stay on this browser until changed or cleared.</p>
            <p>Choosing Essential only does not clear information needed for your cart, orders or the features you choose to use.</p>
          </>,
        },
        {
          id: "analytics", title: "Optional analytics",
          body: <>
            <p>If you choose Allow analytics, we record browser events such as viewing an event or starting checkout. These can include an event reference, a random browser-session identifier, a referring page and browser information.</p>
            <p>Session storage uses tp_analytics_session and tp_event_viewed: entries to group activity and avoid repeated event-view counts. These are used only after you allow analytics. Choosing Essential only stops future optional browser tracking and clears those analytics entries from the current tab.</p>
            <p>We also keep order, payment, refund and ticket-entry records to provide the service, account for sales and investigate problems. Those operational records are separate from optional browser analytics.</p>
          </>,
        },
        {
          id: "manage", title: "Change your choice",
          body: <>
            <p>Use Cookie settings in the footer or below to choose Essential only or Allow analytics. Allowing analytics is optional and does not determine whether you can buy tickets or agree to the terms.</p>
            <CookieSettingsButton className="min-h-11 border border-input bg-paper px-4 py-2 text-[13px] font-semibold text-ink" />
            <p>Choices apply to this browser and site address. Another browser, device or TicketPulse subdomain may ask separately. If your browser blocks storage, your choice can apply to the current page but may not survive a refresh.</p>
            <p>You can also delete or block cookies and browser storage in your browser settings. Blocking essential storage can prevent sign-in, cart persistence or checkout recovery.</p>
          </>,
        },
        {
          id: "partners", title: "Payment partners and external links",
          body: <>
            <p>Hosted payment pages and external services you choose to open may use their own cookies and policies. TicketPulse&apos;s cookie settings control optional analytics on this site, rather than storage on those external services.</p>
            <p>Read our <a href="/legal/privacy">Privacy Policy</a> for how we handle information, or <a href="/contact">contact us</a> with a cookie question.</p>
          </>,
        },
        {
          id: "changes", title: "Policy updates",
          body: <p>We will update this page when our storage use changes. If we introduce a new optional purpose, we will ask for the appropriate choice before enabling it.</p>,
        },
      ]}
    />
  )
}
