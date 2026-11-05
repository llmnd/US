import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_VERCEL_UPLOAD_LIMIT_BYTES:
      process.env.VERCEL === "1" ? String(4 * 1024 * 1024) : "0",
  },
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  poweredByHeader: false,
  experimental: {
    cpus: 2,
  },
  images: {
    qualities: [75, 90],
  },
  turbopack: {
    root: workspaceRoot,
  },
  async rewrites() {
    const apiProxyUrl = process.env.API_PROXY_URL?.replace(/\/+$/, "");
    if (!apiProxyUrl) return [];
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiProxyUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
