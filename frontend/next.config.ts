import type { NextConfig } from "next";

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
        destination: "http://localhost:8000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
