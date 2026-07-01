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
  url: string
}

export default function VerifyEmailEmail({ name, url }: Props) {
  const first = name?.split(" ")[0]?.trim()
  return (
    <EmailShell preview="Verify your email address to start organising events">
      <EmailEyebrow>Action required</EmailEyebrow>
      <EmailHeading>
        {first ? `Verify your email, ${first}.` : "Verify your email address."}
      </EmailHeading>
      <EmailParagraph>
        Thanks for signing up as an organiser on TicketPulse. To start creating
        events you first need to verify your email address.
      </EmailParagraph>
      <EmailParagraph>
        Click the button below to confirm your email. This link expires in 48 hours.
      </EmailParagraph>

      <EmailButton href={url}>Verify email address</EmailButton>

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
          If you did not create an organiser account, you can safely ignore this
          email.
        </Text>
      </Section>
    </EmailShell>
  )
}
