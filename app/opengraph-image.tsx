import { ImageResponse } from "next/og"

export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
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
            height: 8,
            background: "linear-gradient(90deg, #0A2540 0%, #0570DE 60%, #16A34A 100%)",
          }}
        />

        {/* Ticket icon — pure divs */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 120,
            height: 120,
            borderRadius: 28,
            background: "#0A2540",
            marginBottom: 36,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 12,
              border: "4px solid rgba(255,255,255,0.9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: "rgba(255,255,255,0.9)",
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
              fontSize: 96,
              fontWeight: 800,
              color: "#0A2540",
              letterSpacing: "-2px",
              lineHeight: 1,
            }}
          >
            Ticket
          </span>
          <span
            style={{
              fontSize: 96,
              fontWeight: 800,
              color: "#6B7B99",
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
            fontSize: 32,
            color: "#9CAAB8",
            letterSpacing: "0.04em",
            fontWeight: 400,
          }}
        >
          Every event. One ticket.
        </div>

        {/* Bottom accent bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 8,
            background: "linear-gradient(90deg, #0A2540 0%, #0570DE 60%, #16A34A 100%)",
          }}
        />
      </div>
    ),
    { ...size }
  )
}
