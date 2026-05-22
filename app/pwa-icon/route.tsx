import { ImageResponse } from "next/og"

export const runtime = "edge"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const size = Math.min(512, Math.max(48, Number(searchParams.get("size")) || 192))
  const borderRadius = Math.round(size * 0.2)
  const topHighlightHeight = Math.round(size * 0.41)

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
            "linear-gradient(135deg, #131132 0%, #0E1032 55%, #151232 100%)",
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
        {/* Clean ticket icon */}
        <svg
          viewBox="0 0 32 32"
          style={{ width: "65%", height: "65%" }}
          fill="none"
        >
          {/* Ticket body */}
          <rect x="2" y="4" width="28" height="24" rx="3" fill="#909090"/>
          {/* Left notch */}
          <rect x="0" y="10" width="4" height="12" rx="2" fill="#131132"/>
          {/* Right notch */}
          <rect x="28" y="10" width="4" height="12" rx="2" fill="#131132"/>
          {/* Perforation line */}
          <rect x="19" y="4" width="1" height="24" rx="0.5" fill="#FFFFFF" fillOpacity={0.2}/>
          {/* Barcode lines */}
          <rect x="5" y="14" width="2" height="8" rx="0.5" fill="#FFFFFF" fillOpacity={0.4}/>
          <rect x="8" y="14" width="1.5" height="8" rx="0.5" fill="#FFFFFF" fillOpacity={0.25}/>
          <rect x="10.5" y="14" width="2" height="8" rx="0.5" fill="#FFFFFF" fillOpacity={0.4}/>
          <rect x="13.5" y="14" width="1.5" height="8" rx="0.5" fill="#FFFFFF" fillOpacity={0.25}/>
          {/* Accent dot */}
          <circle cx="24" cy="16" r="2" fill="#FFFFFF" fillOpacity={0.5}/>
        </svg>
      </div>
    ),
    { width: size, height: size }
  )
}
