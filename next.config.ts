import type { NextConfig } from "next";

const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline' 'unsafe-eval'`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: https://images.unsplash.com https://res.cloudinary.com https://*.r2.dev`,
  `font-src 'self' data:`,
  `connect-src 'self' https://api.resend.com https://*.r2.dev https://*.r2.cloudflarestorage.com`,
  `frame-src https://www.openstreetmap.org https://maps.google.com https://www.google.com`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `object-src 'none'`,
].join("; ")

const nextConfig: NextConfig = {
  // Enable compression for API responses and static assets
  compress: true,

  // Optimize bundle — tree-shake dev warnings from heavy libraries in prod
  serverExternalPackages: ["@react-pdf/renderer", "passkit-generator"],

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "*.r2.dev" },
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com" },
    ],
    // Enable AVIF for better compression than WebP
    formats: ["image/avif", "image/webp"],
    // Limit device sizes to reduce generated image variants
    deviceSizes: [480, 768, 1024, 1280, 1536],
    // Limit image sizes for cards vs full-width
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), interest-cohort=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
      {
        // Static assets (fonts, images, icons) — cache aggressively
        source: "/:path*((?:fonts|icons|images)/.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ]
  },
};

export default nextConfig;
