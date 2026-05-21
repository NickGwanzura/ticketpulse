import { ImageResponse } from "next/og"

export const runtime = "edge"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const size = Math.min(512, Math.max(48, Number(searchParams.get("size")) || 192))
  const borderRadius = Math.round(size * 0.2)
  const topHighlightHeight = Math.round(size * 0.41)
  const fontSize = Math.round(size * 0.65)
  const dotSize = Math.round(size * 0.115)
  const dotOffset = Math.round(size * 0.16)
  const dotShadow = Math.round(size * 0.032)

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
          borderRadius,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18)",
        }}
      >
        {/* Top highlight */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: topHighlightHeight,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 100%)",
            borderTopLeftRadius: borderRadius,
            borderTopRightRadius: borderRadius,
          }}
        />
        {/* "T" letter */}
        <div
          style={{
            display: "flex",
            color: "#ffffff",
            fontSize,
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
            right: dotOffset,
            bottom: dotOffset,
            width: dotSize,
            height: dotSize,
            borderRadius: 999,
            background: "#34d399",
            boxShadow: `0 0 0 ${dotShadow}px rgba(52,211,153,0.25)`,
          }}
        />
      </div>
    ),
    { width: size, height: size }
  )
}
