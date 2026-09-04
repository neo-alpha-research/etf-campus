import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  experimental: {
    cpus: process.env.CI ? 4 : undefined,
    workerThreads: true,
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;

