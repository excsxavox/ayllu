import type { NextConfig } from "next";

const isFloorApp = process.env.AYLLUU_APP === "movil" || process.env.NEXT_PUBLIC_AYLLUU_APP === "movil";

const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  distDir: isFloorApp ? ".next-movil" : ".next",
  transpilePackages: ["@aylluu/shared"],
  experimental: {
    staleTimes: {
      dynamic: 180,
      static: 180,
    },
  },
  async rewrites() {
    if (!isFloorApp) return [];
    return [{ source: "/backend/:path*", destination: `${apiOrigin}/:path*` }];
  },
};

export default nextConfig;
