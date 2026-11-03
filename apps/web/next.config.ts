import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const nextConfig: NextConfig = {
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
};

export default nextConfig;
