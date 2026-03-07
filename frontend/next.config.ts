import type { NextConfig } from "next";

const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:8000/api";

const nextConfig: NextConfig = {
  output: "standalone",
  // Disable gzip to prevent SSE event buffering during development.
  // Production SSE will bypass the Next.js proxy entirely (browser → backend direct).
  compress: false,
  experimental: {
    proxyTimeout: 1000 * 120,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiBaseUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
