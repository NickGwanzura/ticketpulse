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
  resetUrl: string
}

export default function ResetPasswordEmail({ name, resetUrl }: Props) {
  const greeting = name?.trim() ? `Hi ${name},` : "Hi there,"

  return (
    <EmailShell preview="Reset your TicketPulse password">
      <EmailEyebrow>Password reset</EmailEyebrow>
      <EmailHeading>Reset your TicketPulse password.</EmailHeading>
      <EmailParagraph>{greeting}</EmailParagraph>
      <EmailParagraph>
        We received a request to reset the password for your TicketPulse account. Tap the button below to choose a new one. This link expires in one hour.
      </EmailParagraph>

      <EmailButton href={resetUrl}>Reset password</EmailButton>

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
          <a href={resetUrl} style={{ color: BRAND.blue, textDecoration: "underline" }}>
            {resetUrl}
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
          Didn&apos;t request this? You can safely ignore this email. Your password won&apos;t change.
        </Text>
      </Section>
    </EmailShell>
  )
}
