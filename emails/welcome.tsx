import { Section, Text } from "@react-email/components"
import {
  BRAND,
  EmailButton,
  EmailEyebrow,
  EmailHeading,
  EmailParagraph,
  EmailShell,
} from "./_shell"

type Props = {
  name?: string | null
  url?: string
}

export default function WelcomeEmail({ name, url = BRAND.url }: Props) {
  const first = name?.split(" ")[0]?.trim()
  return (
    <EmailShell preview="Welcome to TicketPulse. One ticket, every event.">
      <EmailEyebrow>Welcome</EmailEyebrow>
      <EmailHeading>
        {first ? `Welcome, ${first}.` : "Welcome to TicketPulse."}
      </EmailHeading>
      <EmailParagraph>
        You&apos;re in. TicketPulse is Zimbabwe&apos;s home for live events: concerts, marathons, film, and more. EcoCash and Visa, printable PDF tickets, mobile QR at the gate.
      </EmailParagraph>
      <EmailParagraph>
        Start by browsing what&apos;s on. We&apos;ll only email you when there&apos;s a real reason to.
      </EmailParagraph>

      <EmailButton href={`${url}/events`}>Browse events</EmailButton>

      <Section
        style={{
          marginTop: 24,
          padding: 16,
          backgroundColor: BRAND.blueSoft,
          borderRadius: 12,
        }}
      >
        <Text
          style={{
            fontSize: 13,
            color: BRAND.ink2,
            margin: 0,
            lineHeight: "20px",
          }}
        >
          Hosting an event? You can sell tickets in minutes.{" "}
          <a
            href={`${url}/how-it-works`}
            style={{ color: BRAND.blue, textDecoration: "underline" }}
          >
            see how it works
          </a>
          .
        </Text>
      </Section>
    </EmailShell>
  )
}
