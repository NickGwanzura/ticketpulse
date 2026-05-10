import { ImageResponse } from "next/og"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          background:
            "radial-gradient(120% 80% at 80% 10%, rgba(5,112,222,0.55) 0%, rgba(5,112,222,0) 60%), linear-gradient(135deg, #1a4f8c 0%, #0a2540 55%, #07182b 100%)",
          borderRadius: 38,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 78,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 100%)",
            borderTopLeftRadius: 38,
            borderTopRightRadius: 38,
          }}
        />
        <div
          style={{
            display: "flex",
            color: "#ffffff",
            fontSize: 124,
            fontWeight: 800,
            letterSpacing: "-0.06em",
            lineHeight: 1,
            transform: "translateY(-4px)",
          }}
        >
          T
        </div>
        {/* Pulse dot */}
        <div
          style={{
            position: "absolute",
            right: 30,
            bottom: 30,
            width: 22,
            height: 22,
            borderRadius: 999,
            background: "#34d399",
            boxShadow: "0 0 0 6px rgba(52,211,153,0.25)",
          }}
        />
      </div>
    ),
    { ...size }
  )
}
