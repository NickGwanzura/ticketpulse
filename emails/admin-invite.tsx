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
  role: string
  inviteUrl: string
  inviterName?: string | null
}

const ROLE_COPY: Record<string, string> = {
  attendee: "an attendee",
  organizer: "an organizer",
  vendor: "a vendor",
  admin: "an admin",
}

export default function AdminInviteEmail({ role, inviteUrl, inviterName }: Props) {
  const roleLabel = ROLE_COPY[role] ?? `a ${role}`
  const fromLine = inviterName?.trim()
    ? `${inviterName} has invited you to join TicketPulse as ${roleLabel}.`
    : `You’ve been invited to join TicketPulse as ${roleLabel}.`

  return (
    <EmailShell preview={`You're invited to TicketPulse as ${roleLabel}.`}>
      <EmailEyebrow>Invitation</EmailEyebrow>
      <EmailHeading>You&apos;re invited to TicketPulse.</EmailHeading>
      <EmailParagraph>{fromLine}</EmailParagraph>
      <EmailParagraph>
        Your account is ready. Tap the button below and request a sign-in link with this email address. Your role is already set up.
      </EmailParagraph>

      <EmailButton href={inviteUrl}>Accept invitation</EmailButton>

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
          <a href={inviteUrl} style={{ color: BRAND.blue, textDecoration: "underline" }}>
            {inviteUrl}
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
          Didn&apos;t expect this? You can ignore the email. No action will be taken on your behalf.
        </Text>
      </Section>
    </EmailShell>
  )
}
