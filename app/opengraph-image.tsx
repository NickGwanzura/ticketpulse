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
          position: "relative",
          background:
            "radial-gradient(120% 80% at 80% 10%, rgba(5,112,222,0.55) 0%, rgba(5,112,222,0) 60%), linear-gradient(135deg, #1a4f8c 0%, #0a2540 55%, #07182b 100%)",
        }}
      >
        {/* Top highlight */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 140,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 100%)",
          }}
        />

        {/* Brand mark */}
        <div
          style={{
            display: "flex",
            color: "#ffffff",
            fontSize: 160,
            fontWeight: 800,
            letterSpacing: "-0.06em",
            lineHeight: 1,
            marginBottom: 16,
          }}
        >
          TicketPulse
        </div>

        {/* Tagline */}
        <div
          style={{
            display: "flex",
            color: "rgba(255,255,255,0.7)",
            fontSize: 36,
            fontWeight: 400,
            letterSpacing: "0.02em",
          }}
        >
          Every event. One ticket.
        </div>

        {/* Pulse dot */}
        <div
          style={{
            position: "absolute",
            right: 48,
            bottom: 48,
            width: 28,
            height: 28,
            borderRadius: 999,
            background: "#8DD32F",
            boxShadow: "0 0 0 8px rgba(141,211,47,0.25)",
          }}
        />
      </div>
    ),
    { ...size }
  )
}
