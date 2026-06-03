import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components"

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketplse.tech"

export const BRAND = {
  ink: "#0B1220",
  ink2: "#384151",
  ink3: "#6B7280",
  paper: "#FFFFFF",
  paper2: "#F6F9FC",
  line: "#E6ECF2",
  blue: "#2D6CDF",
  blueSoft: "#EAF2FA",
  navy: "#0B1F4A",
  url: APP_URL,
} as const

type ShellProps = {
  preview: string
  children: React.ReactNode
}

export function EmailShell({ preview, children }: ShellProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Tailwind>
        <Body
          style={{
            backgroundColor: BRAND.paper2,
            margin: 0,
            fontFamily:
              "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
            color: BRAND.ink,
          }}
        >
          <Container
            style={{
              maxWidth: 560,
              margin: "0 auto",
              padding: "32px 16px",
            }}
          >
            {/* Brand header */}
            <Section style={{ paddingBottom: 8 }}>
              <table cellPadding={0} cellSpacing={0} role="presentation">
                <tr>
                  <td style={{ verticalAlign: "middle", paddingRight: 10 }}>
                    <Img
                      src={`${BRAND.url}/ticketpulse-logo.svg`}
                      alt="TicketPulse"
                      width={40}
                      height={40}
                      style={{
                        display: "block",
                        outline: "none",
                        border: "none",
                        borderRadius: 6,
                      }}
                    />
                  </td>
                  <td style={{ verticalAlign: "middle" }}>
                    <Text
                      style={{
                        margin: 0,
                        fontSize: 18,
                        fontWeight: 700,
                        letterSpacing: "-0.01em",
                        color: BRAND.ink,
                      }}
                    >
                      TicketPulse
                    </Text>
                  </td>
                </tr>
              </table>
            </Section>

            {/* Card */}
            <Section
              style={{
                backgroundColor: BRAND.paper,
                border: `1px solid ${BRAND.line}`,
                borderRadius: 16,
                padding: "32px 28px",
                boxShadow: "0 1px 2px rgba(11,18,32,0.04)",
              }}
            >
              {children}
            </Section>

            {/* Footer */}
            <Section style={{ paddingTop: 20 }}>
              <Hr style={{ borderColor: BRAND.line, margin: "0 0 16px" }} />
              <Text
                style={{
                  fontSize: 12,
                  lineHeight: "18px",
                  color: BRAND.ink3,
                  margin: 0,
                }}
              >
                TicketPulse · Harare, Zimbabwe ·{" "}
                <Link href={BRAND.url} style={{ color: BRAND.ink2, textDecoration: "underline" }}>
                  ticketplse.tech
                </Link>
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  lineHeight: "18px",
                  color: BRAND.ink3,
                  margin: "6px 0 0",
                }}
              >
                You&apos;re receiving this because of activity on your TicketPulse account.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}

type ButtonProps = {
  href: string
  children: React.ReactNode
  variant?: "primary" | "secondary"
}

export function EmailButton({ href, children, variant = "primary" }: ButtonProps) {
  const isPrimary = variant === "primary"
  return (
    <table cellPadding={0} cellSpacing={0} role="presentation" style={{ margin: "8px 0" }}>
      <tr>
        <td>
          <Link
            href={href}
            style={{
              display: "inline-block",
              padding: "12px 22px",
              borderRadius: 12,
              backgroundColor: isPrimary ? BRAND.navy : BRAND.paper,
              color: isPrimary ? "#FFFFFF" : BRAND.ink,
              border: isPrimary ? "none" : `1px solid ${BRAND.line}`,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
              letterSpacing: "-0.005em",
            }}
          >
            {children}
          </Link>
        </td>
      </tr>
    </table>
  )
}

type EyebrowProps = {
  children: React.ReactNode
  tone?: "blue" | "ink"
}

export function EmailEyebrow({ children, tone = "blue" }: EyebrowProps) {
  const color = tone === "ink" ? BRAND.ink3 : BRAND.blue
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color,
        margin: "0 0 6px",
      }}
    >
      {children}
    </Text>
  )
}

export function EmailHeading({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        fontSize: 24,
        fontWeight: 700,
        lineHeight: "1.2",
        letterSpacing: "-0.02em",
        color: BRAND.ink,
        margin: "0 0 12px",
      }}
    >
      {children}
    </Text>
  )
}

export function EmailParagraph({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        fontSize: 15,
        lineHeight: "24px",
        color: BRAND.ink2,
        margin: "0 0 14px",
      }}
    >
      {children}
    </Text>
  )
}
