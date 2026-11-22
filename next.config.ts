import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Content Security Policy without nonces: inline scripts and styles are
// allowed, everything else may only come from the app itself (the font is
// self-hosted by Next.js). `next dev` needs eval for its error overlay.
// No upgrade-insecure-requests: it breaks http://localhost (dev, e2e), and on
// the server HSTS already keeps the browser on HTTPS
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  // HTTPS only for 2 years; ignored by browsers on plain http://localhost
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // No framing: frame-ancestors above for current browsers, this for old ones
  { key: "X-Frame-Options", value: "DENY" },
  // Other sites never see the address of a page in the app
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Only features Chrome knows: unknown ones are reported in the console
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  // Self-contained server in .next/standalone for the Docker image
  output: "standalone",
  // Don't tell who made the app: no "X-Powered-By: Next.js"
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    agentUpgrade: "security",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
