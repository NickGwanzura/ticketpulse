import localFont from "next/font/local"

/**
 * Clash Display — a sharp, modern geometric sans for headings.
 * https://fontshare.com/fonts/clash-display
 */
export const clashDisplay = localFont({
  src: [
    {
      path: "../public/fonts/ClashDisplay-Light.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "../public/fonts/ClashDisplay-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/ClashDisplay-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../public/fonts/ClashDisplay-Semibold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../public/fonts/ClashDisplay-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  display: "swap",
  preload: true,
  fallback: ["system-ui", "sans-serif"],
  variable: "--font-heading",
})

/**
 * General Sans — a humanist sans-serif optimised for body text and UI.
 * https://fontshare.com/fonts/general-sans
 */
export const generalSans = localFont({
  src: [
    {
      path: "../public/fonts/GeneralSans-Light.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "../public/fonts/GeneralSans-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/GeneralSans-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../public/fonts/GeneralSans-Semibold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../public/fonts/GeneralSans-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  display: "swap",
  preload: true,
  fallback: ["system-ui", "sans-serif"],
  variable: "--font-body",
})

/**
 * PolySans — a geometric sans-serif with soft-edge inktrap details,
 * designed by Gradient. Trial weights from fontshare-gradeint.
 */
export const polysans = localFont({
  src: [
    { path: "../public/fonts/polysans-Slim.woff2", weight: "300", style: "normal" },
    { path: "../public/fonts/polysans-Neutral.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/polysans-Median.woff2", weight: "500", style: "normal" },
    { path: "../public/fonts/polysans-Bulky.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  preload: true,
  fallback: ["system-ui", "sans-serif"],
  variable: "--font-polysans",
})

export const polysansWide = localFont({
  src: [
    { path: "../public/fonts/polysans-SlimWide.woff2", weight: "300", style: "normal" },
    { path: "../public/fonts/polysans-NeutralWide.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/polysans-MedianWide.woff2", weight: "500", style: "normal" },
    { path: "../public/fonts/polysans-BulkyWide.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  preload: true,
  fallback: ["system-ui", "sans-serif"],
  variable: "--font-polysans-wide",
})
