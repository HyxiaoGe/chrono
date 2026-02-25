import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable gzip to prevent SSE event buffering during development.
  // Production SSE will bypass the Next.js proxy entirely (browser → backend direct).
  compress: false,
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
