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
            "linear-gradient(135deg, #131132 0%, #0E1032 55%, #151232 100%)",
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
        {/* Clean ticket icon */}
        <svg
          viewBox="0 0 32 32"
          style={{ width: 110, height: 110 }}
          fill="none"
        >
          {/* Ticket body */}
          <rect x="2" y="4" width="28" height="24" rx="3" fill="#909090"/>
          {/* Left notch */}
          <rect x="0" y="10" width="4" height="12" rx="2" fill="#131132"/>
          {/* Right notch */}
          <rect x="28" y="10" width="4" height="12" rx="2" fill="#131132"/>
          {/* Perforation line */}
          <rect x="19" y="4" width="1.5" height="24" rx="0.5" fill="#FFFFFF" fillOpacity={0.2}/>
          {/* Barcode lines */}
          <rect x="5" y="14" width="2.5" height="8" rx="0.5" fill="#FFFFFF" fillOpacity={0.4}/>
          <rect x="8.5" y="14" width="2" height="8" rx="0.5" fill="#FFFFFF" fillOpacity={0.25}/>
          <rect x="11.5" y="14" width="2.5" height="8" rx="0.5" fill="#FFFFFF" fillOpacity={0.4}/>
          <rect x="15" y="14" width="2" height="8" rx="0.5" fill="#FFFFFF" fillOpacity={0.25}/>
          {/* Accent dot */}
          <circle cx="24" cy="16" r="2.5" fill="#FFFFFF" fillOpacity={0.5}/>
        </svg>
      </div>
    ),
    { ...size }
  )
}
