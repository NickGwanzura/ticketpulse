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
  buyerName?: string | null
  eventTitle: string
  eventDate: string
  eventVenue?: string
  ticketUrl: string
  url?: string
}

export default function EventReminderEmail({
  buyerName,
  eventTitle,
  eventDate,
  eventVenue,
  ticketUrl,
  url = BRAND.url,
}: Props) {
  const first = buyerName?.split(" ")[0]?.trim()
  return (
    <EmailShell preview={`Don't forget — ${eventTitle} is tomorrow!`}>
      <EmailEyebrow tone="blue">Event reminder</EmailEyebrow>
      <EmailHeading>
        {first ? `${eventTitle} is tomorrow, ${first}! 🎉` : `${eventTitle} is tomorrow! 🎉`}
      </EmailHeading>
      <EmailParagraph>
        This is a friendly reminder that <strong style={{ color: BRAND.ink }}>{eventTitle}</strong> is happening
        tomorrow. We can&apos;t wait to see you there!
      </EmailParagraph>

      <EmailButton href={ticketUrl}>View your tickets</EmailButton>

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
          Event Details
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
          📅 {eventDate}
          {eventVenue ? ` · 📍 ${eventVenue}` : ""}
        </Text>
      </Section>

      <Section style={{ marginTop: 20 }}>
        <Text style={{ fontSize: 13, color: BRAND.ink2, margin: 0, lineHeight: "20px" }}>
          Make sure to bring your ticket (digital or printed) to the door. You can view or download
          it anytime from your{" "}
          <a
            href={ticketUrl}
            style={{ color: BRAND.blue, textDecoration: "underline" }}
          >
            ticket page
          </a>.
        </Text>
      </Section>

      <Section style={{ marginTop: 16 }}>
        <Text style={{ fontSize: 13, color: BRAND.ink2, margin: 0, lineHeight: "20px" }}>
          Need help? Reply to this email or message us on{" "}
          <a
            href="https://wa.me/263788689923"
            style={{ color: BRAND.blue, textDecoration: "underline" }}
          >
            WhatsApp
          </a>.
        </Text>
      </Section>
    </EmailShell>
  )
}
