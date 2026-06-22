import { ImageResponse } from "next/og"

export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const alt = "TicketPulse - Every event. One ticket."

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "72px 88px",
          background: "linear-gradient(135deg, #0A2540 0%, #131132 58%, #1D1A46 100%)",
          position: "relative",
        }}
      >
        {/* Top accent bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 10,
            background: "linear-gradient(90deg, #84FF00 0%, #42E66B 48%, #4DB8FF 100%)",
          }}
        />

        {/* Ticket icon — pure divs */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 104,
            height: 104,
            borderRadius: 26,
            background: "rgba(255,255,255,0.1)",
            border: "2px solid rgba(255,255,255,0.15)",
            marginBottom: 42,
          }}
        >
          <div
            style={{
              width: 58,
              height: 52,
              borderRadius: 10,
              border: "4px solid #84FF00",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 20,
                height: 28,
                borderLeft: "3px dashed rgba(255,255,255,0.75)",
              }}
            />
          </div>
        </div>

        {/* Wordmark */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 0,
          }}
        >
          <span
            style={{
              fontSize: 92,
              fontWeight: 800,
              color: "#FFFFFF",
              letterSpacing: "-2px",
              lineHeight: 1,
            }}
          >
            Ticket
          </span>
          <span
            style={{
              fontSize: 92,
              fontWeight: 800,
              color: "#84FF00",
              letterSpacing: "-2px",
              lineHeight: 1,
            }}
          >
            Pulse
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            marginTop: 20,
          fontSize: 34,
          color: "rgba(255,255,255,0.78)",
            letterSpacing: "0.04em",
            fontWeight: 400,
          }}
        >
          Sell tickets. Scan guests. Get paid.
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 52,
            gap: 18,
            fontSize: 20,
            color: "rgba(255,255,255,0.68)",
            letterSpacing: "0.03em",
          }}
        >
          <span>Zimbabwean payments</span>
          <span style={{ color: "#84FF00" }}>•</span>
          <span>Instant QR delivery</span>
          <span style={{ color: "#84FF00" }}>•</span>
          <span>Built-in gate scanning</span>
        </div>

        {/* Bottom accent bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 10,
            background: "linear-gradient(90deg, #84FF00 0%, #42E66B 48%, #4DB8FF 100%)",
          }}
        />
      </div>
    ),
    { ...size }
  )
}
