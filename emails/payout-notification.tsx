import { Hr, Section, Text } from "@react-email/components"
import {
  BRAND,
  EmailButton,
  EmailEyebrow,
  EmailHeading,
  EmailParagraph,
  EmailShell,
} from "./_shell"

type Props = {
  organizerName?: string | null
  payoutId: string
  amount: string
  currency: string
  method: "EcoCash" | "Visa" | "USD" | "ZAR" | string
  destination: string
  eventTitle: string
  url?: string
}

export default function PayoutNotificationEmail({
  organizerName,
  payoutId,
  amount,
  currency,
  method,
  destination,
  eventTitle,
  url = BRAND.url,
}: Props) {
  const first = organizerName?.split(" ")[0]?.trim()
  return (
    <EmailShell preview={`Payout sent: ${amount} ${currency} to ${destination}`}>
      <EmailEyebrow tone="emerald">Payout sent</EmailEyebrow>
      <EmailHeading>
        {first ? `${first}, your payout is on the way.` : "Your payout is on the way."}
      </EmailHeading>
      <EmailParagraph>
        Net proceeds for <strong style={{ color: BRAND.ink }}>{eventTitle}</strong> have been released to your nominated account.
      </EmailParagraph>

      <Section
        style={{
          marginTop: 12,
          padding: 18,
          border: `1px solid ${BRAND.line}`,
          borderRadius: 14,
          backgroundColor: BRAND.paper2,
        }}
      >
        <table cellPadding={0} cellSpacing={0} role="presentation" style={{ width: "100%" }}>
          <tr>
            <td style={{ paddingTop: 2, paddingBottom: 2, color: BRAND.ink3, fontSize: 12 }}>
              Amount
            </td>
            <td
              style={{
                paddingTop: 2,
                paddingBottom: 2,
                textAlign: "right",
                color: BRAND.ink,
                fontSize: 18,
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {amount} {currency}
            </td>
          </tr>
          <tr>
            <td colSpan={2}>
              <Hr style={{ borderColor: BRAND.line, margin: "12px 0" }} />
            </td>
          </tr>
          <tr>
            <td style={{ paddingTop: 4, paddingBottom: 4, color: BRAND.ink3, fontSize: 12 }}>
              Method
            </td>
            <td
              style={{
                paddingTop: 4,
                paddingBottom: 4,
                textAlign: "right",
                color: BRAND.ink2,
                fontSize: 13,
              }}
            >
              {method}
            </td>
          </tr>
          <tr>
            <td style={{ paddingTop: 4, paddingBottom: 4, color: BRAND.ink3, fontSize: 12 }}>
              Sent to
            </td>
            <td
              style={{
                paddingTop: 4,
                paddingBottom: 4,
                textAlign: "right",
                color: BRAND.ink2,
                fontSize: 13,
              }}
            >
              {destination}
            </td>
          </tr>
          <tr>
            <td style={{ paddingTop: 4, paddingBottom: 4, color: BRAND.ink3, fontSize: 12 }}>
              Reference
            </td>
            <td
              style={{
                paddingTop: 4,
                paddingBottom: 4,
                textAlign: "right",
                color: BRAND.ink2,
                fontSize: 13,
              }}
            >
              #{payoutId}
            </td>
          </tr>
        </table>
      </Section>

      <Section style={{ marginTop: 20 }}>
        <EmailButton href={`${url}/payouts`} variant="secondary">
          View payout history
        </EmailButton>
      </Section>

      <Section style={{ marginTop: 12 }}>
        <Text style={{ fontSize: 12, color: BRAND.ink3, margin: 0, lineHeight: "18px" }}>
          EcoCash typically lands within minutes; bank transfers can take 1 to 3 business days.
        </Text>
      </Section>
    </EmailShell>
  )
}
