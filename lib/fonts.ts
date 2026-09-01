import localFont from "next/font/local"

export const grift = localFont({
  src: [
    { path: "../public/fonts/Grift-Thin.woff2",            weight: "100", style: "normal" },
    { path: "../public/fonts/Grift-ThinItalic.woff2",      weight: "100", style: "italic" },
    { path: "../public/fonts/Grift-ExtraLight.woff2",      weight: "200", style: "normal" },
    { path: "../public/fonts/Grift-ExtraLightItalic.woff2",weight: "200", style: "italic" },
    { path: "../public/fonts/Grift-Light.woff2",           weight: "300", style: "normal" },
    { path: "../public/fonts/Grift-LightItalic.woff2",     weight: "300", style: "italic" },
    { path: "../public/fonts/Grift-Regular.woff2",         weight: "400", style: "normal" },
    { path: "../public/fonts/Grift-Italic.woff2",          weight: "400", style: "italic" },
    { path: "../public/fonts/Grift-Medium.woff2",          weight: "500", style: "normal" },
    { path: "../public/fonts/Grift-MediumItalic.woff2",    weight: "500", style: "italic" },
    { path: "../public/fonts/Grift-SemiBold.woff2",        weight: "600", style: "normal" },
    { path: "../public/fonts/Grift-SemiBoldItalic.woff2",  weight: "600", style: "italic" },
    { path: "../public/fonts/Grift-Bold.woff2",            weight: "700", style: "normal" },
    { path: "../public/fonts/Grift-BoldItalic.woff2",      weight: "700", style: "italic" },
    { path: "../public/fonts/Grift-ExtraBold.woff2",       weight: "800", style: "normal" },
    { path: "../public/fonts/Grift-ExtraBoldItalic.woff2", weight: "800", style: "italic" },
    { path: "../public/fonts/Grift-Black.woff2",           weight: "900", style: "normal" },
    { path: "../public/fonts/Grift-BlackItalic.woff2",     weight: "900", style: "italic" },
  ],
  display: "swap",
  preload: true,
  fallback: ["system-ui", "sans-serif"],
  variable: "--font-grift",
})

export const mona = localFont({
  src: [
    { path: "../public/fonts/MonaSansVariable.woff2",         weight: "200 900", style: "normal" },
    { path: "../public/fonts/MonaSansVariable-Italic.woff2",  weight: "200 900", style: "italic" },
  ],
  display: "swap",
  preload: true,
  fallback: ["system-ui", "sans-serif"],
  variable: "--font-mona",
})
