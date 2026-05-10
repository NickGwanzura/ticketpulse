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
  url: string
  host?: string
}

export default function MagicLinkEmail({ url, host = "ticketpulse.tech" }: Props) {
  return (
    <EmailShell preview="Your sign-in link to TicketPulse">
      <EmailEyebrow>Sign in</EmailEyebrow>
      <EmailHeading>One tap and you&apos;re in.</EmailHeading>
      <EmailParagraph>
        Use the button below to sign in to TicketPulse. This link expires in 24 hours and can only be used once.
      </EmailParagraph>

      <EmailButton href={url}>Sign in to TicketPulse</EmailButton>

      <Section style={{ marginTop: 20 }}>
        <Text
          style={{
            fontSize: 12,
            color: BRAND.ink3,
            margin: 0,
            lineHeight: "18px",
          }}
        >
          Or paste this link into your browser:
        </Text>
        <Text
          style={{
            fontSize: 12,
            color: BRAND.ink2,
            margin: "4px 0 0",
            wordBreak: "break-all",
          }}
        >
          <a href={url} style={{ color: BRAND.blue, textDecoration: "underline" }}>
            {url}
          </a>
        </Text>
      </Section>

      <Section
        style={{
          marginTop: 24,
          padding: 14,
          border: `1px solid ${BRAND.line}`,
          borderRadius: 12,
          backgroundColor: BRAND.paper2,
        }}
      >
        <Text
          style={{
            fontSize: 12,
            color: BRAND.ink3,
            margin: 0,
            lineHeight: "18px",
          }}
        >
          Didn&apos;t request this? Ignore the email. Your account stays safe. The link came from {host}.
        </Text>
      </Section>
    </EmailShell>
  )
}
