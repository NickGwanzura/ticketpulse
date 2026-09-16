import { Hr, Section, Text } from "@react-email/components"
import {
  BRAND,
  EmailButton,
  EmailEyebrow,
  EmailHeading,
  EmailParagraph,
  EmailShell,
} from "./_shell"

export type OrderLine = {
  label: string
  qty: number
  amount: string
}

type Props = {
  buyerName?: string | null
  orderId: string
  eventTitle: string
  eventDate: string
  eventVenue?: string
  lines: OrderLine[]
  total: string
  currency: string
  ticketUrl: string
  url?: string
  /** Recipient address — included in the order link so the buyer's browser can
   *  prove ownership of the order (see lib/order-access.ts). */
  ownerEmail?: string | null
}

export default function OrderConfirmationEmail({
  buyerName,
  orderId,
  eventTitle,
  eventDate,
  eventVenue,
  lines,
  total,
  currency,
  ticketUrl,
  url = BRAND.url,
  ownerEmail,
}: Props) {
  const first = buyerName?.split(" ")[0]?.trim()
  return (
    <EmailShell preview={`You're going to ${eventTitle}. Tickets attached.`}>
      <EmailEyebrow tone="blue">Order confirmed</EmailEyebrow>
      <EmailHeading>
        {first ? `You're in, ${first}.` : "You're in."}
      </EmailHeading>
      <EmailParagraph>
        Tickets for <strong style={{ color: BRAND.ink }}>{eventTitle}</strong> are ready. Show the QR at the gate or print the PDF. Both work, even offline.
      </EmailParagraph>

      <EmailButton href={ticketUrl}>View / download tickets</EmailButton>

      <Section
        style={{
          marginTop: 24,
          padding: 18,
          border: `1px solid ${BRAND.line}`,
          borderRadius: 14,
          backgroundColor: BRAND.paper2,
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: BRAND.ink3,
            margin: "0 0 8px",
          }}
        >
          Event
        </Text>
        <Text style={{ fontSize: 16, fontWeight: 600, color: BRAND.ink, margin: 0 }}>
          {eventTitle}
        </Text>
        <Text
          style={{
            fontSize: 13,
            color: BRAND.ink2,
            margin: "4px 0 0",
            lineHeight: "20px",
          }}
        >
          {eventDate}
          {eventVenue ? ` · ${eventVenue}` : ""}
        </Text>

        <Hr style={{ borderColor: BRAND.line, margin: "16px 0" }} />

        <Text
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: BRAND.ink3,
            margin: "0 0 8px",
          }}
        >
          Order
        </Text>
        <table cellPadding={0} cellSpacing={0} role="presentation" style={{ width: "100%" }}>
          {lines.map((l, i) => (
            <tr key={i}>
              <td style={{ paddingTop: 4, paddingBottom: 4, color: BRAND.ink2, fontSize: 13 }}>
                {l.qty}× {l.label}
              </td>
              <td
                style={{
                  paddingTop: 4,
                  paddingBottom: 4,
                  textAlign: "right",
                  color: BRAND.ink,
                  fontSize: 13,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {l.amount}
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={2}>
              <Hr style={{ borderColor: BRAND.line, margin: "10px 0" }} />
            </td>
          </tr>
          <tr>
            <td
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: BRAND.ink,
              }}
            >
              Total
            </td>
            <td
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: BRAND.ink,
                textAlign: "right",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {total} {currency}
            </td>
          </tr>
        </table>

        <Text
          style={{
            fontSize: 11,
            color: BRAND.ink3,
            margin: "12px 0 0",
            letterSpacing: "0.04em",
          }}
        >
          Order #{orderId}
        </Text>
      </Section>

      <Section style={{ marginTop: 20 }}>
        <Text style={{ fontSize: 13, color: BRAND.ink2, margin: 0, lineHeight: "20px" }}>
          Need to refund or change tickets? You can manage this order from your{" "}
          <a
            href={`${url}/orders/${orderId}${ownerEmail ? `?email=${encodeURIComponent(ownerEmail.toLowerCase())}` : ""}`}
            style={{ color: BRAND.blue, textDecoration: "underline" }}
          >
            order page
          </a>{" "}
          up to 24 hours before the event.
        </Text>
      </Section>
    </EmailShell>
  )
}
