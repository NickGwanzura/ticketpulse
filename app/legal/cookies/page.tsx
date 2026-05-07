import LegalLayout from "@/components/layout/LegalLayout"

export default function CookiesPage() {
  return (
    <LegalLayout
      kicker="Legal"
      title="Cookie Policy"
      lastUpdated="May 2026"
      intro="Cookies are small text files we (and our partners) place on your device. Here's exactly which ones we use and why, plus how to switch them off."
      sections={[
        {
          id: "what", title: "What is a cookie?",
          body: <>
            <p>A cookie is a small piece of data stored by your browser. We use them to keep you signed in, remember preferences, and (with consent) understand how the site is used.</p>
            <p>You can clear or block cookies in your browser at any time. Some cookies are essential, turning them off will stop sign-in working.</p>
          </>,
        },
        {
          id: "essential", title: "Essential cookies",
          body: <>
            <p>These cookies are required for the platform to function. They cannot be turned off via the consent banner.</p>
            <ul>
              <li><strong>authjs.session-token</strong>, keeps you signed in. Expires after 30 days of inactivity.</li>
              <li><strong>authjs.csrf-token</strong>, protects forms from cross-site request forgery.</li>
              <li><strong>tp_session</strong>, short-lived session ID for fraud detection (24 hours).</li>
            </ul>
          </>,
        },
        {
          id: "preferences", title: "Preference cookies",
          body: <>
            <p>These cookies remember your choices to make repeat visits smoother.</p>
            <ul>
              <li><strong>tp_currency</strong>, remembers your preferred currency for prices (USD / ZAR / GBP).</li>
              <li><strong>tp_locale</strong>, remembers your language preference.</li>
            </ul>
          </>,
        },
        {
          id: "analytics", title: "Analytics cookies",
          body: <>
            <p>These help us understand which features get used so we can prioritize improvements. They are <strong>only set if you opt in</strong> via the consent banner.</p>
            <ul>
              <li><strong>_ph_*</strong> (PostHog), anonymized session and event data, retained 6 months.</li>
            </ul>
            <p>We do not use third-party advertising cookies.</p>
          </>,
        },
        {
          id: "manage", title: "Managing cookies",
          body: <>
            <p>You can:</p>
            <ul>
              <li>Adjust your choices any time via the &ldquo;Cookie settings&rdquo; link in the footer.</li>
              <li>Block all non-essential cookies in your browser settings.</li>
              <li>Use private/incognito browsing to drop all cookies on close.</li>
            </ul>
            <p>If you opt out of analytics, the &ldquo;_ph_*&rdquo; cookies will be deleted on your next page load.</p>
          </>,
        },
        {
          id: "changes", title: "Changes",
          body: <>
            <p>If we change which cookies we use, we will update this page and request fresh consent for any new analytics or marketing cookies.</p>
          </>,
        },
      ]}
    />
  )
}
