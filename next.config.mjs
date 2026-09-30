const defaultFrameAncestors =
  process.env.NODE_ENV === "production"
    ? "'self' https://dashboardku.apotekku.com"
    : "'self' http://localhost:3000 http://localhost:3001 http://localhost:5173";

const frameAncestors =
  process.env.ALLOWED_FRAME_ANCESTORS || defaultFrameAncestors;

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors ${frameAncestors}`,
          },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
