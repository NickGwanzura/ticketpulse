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
  eventTitle: string
  amount: string
  currency: string
  expiresInHours?: number
}

export default function VerifyPurchaseEmail({
  url,
  eventTitle,
  amount,
  currency,
  expiresInHours = 24,
}: Props) {
  return (
    <EmailShell preview={`Tap to confirm and receive your ${eventTitle} tickets`}>
      <EmailEyebrow tone="blue">One last step</EmailEyebrow>
      <EmailHeading>Confirm to receive your tickets.</EmailHeading>
      <EmailParagraph>
        Your payment of <strong style={{ color: BRAND.ink }}>{amount} {currency}</strong> for <strong style={{ color: BRAND.ink }}>{eventTitle}</strong> went through. Click below to confirm this email is yours. We&apos;ll send your tickets instantly.
      </EmailParagraph>

      <EmailButton href={url}>Confirm &amp; get my tickets</EmailButton>

      <Section style={{ marginTop: 18 }}>
        <Text style={{ fontSize: 12, color: BRAND.ink3, margin: 0, lineHeight: "18px" }}>
          Or paste this link into your browser:
        </Text>
        <Text style={{ fontSize: 12, color: BRAND.ink2, margin: "4px 0 0", wordBreak: "break-all" }}>
          <a href={url} style={{ color: BRAND.blue, textDecoration: "underline" }}>{url}</a>
        </Text>
      </Section>

      <Section
        style={{
          marginTop: 22,
          padding: 14,
          border: `1px solid ${BRAND.line}`,
          borderRadius: 12,
          backgroundColor: BRAND.paper2,
        }}
      >
        <Text style={{ fontSize: 12, color: BRAND.ink3, margin: 0, lineHeight: "18px" }}>
          This link expires in {expiresInHours} hours. If you don&apos;t confirm, your purchase is automatically refunded.
        </Text>
      </Section>

      <Section style={{ marginTop: 12 }}>
        <Text style={{ fontSize: 12, color: BRAND.ink3, margin: 0, lineHeight: "18px" }}>
          Didn&apos;t buy these tickets? Reply to this email and we&apos;ll cancel and refund right away.
        </Text>
      </Section>
    </EmailShell>
  )
}
