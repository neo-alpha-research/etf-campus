import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  ...(isDev ? {} : { output: "export" }),
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  experimental: {
    cpus: process.env.CI ? 4 : undefined,
    workerThreads: true,
    optimizePackageImports: ["lucide-react"],
  },
  ...(isDev
    ? {
        async rewrites() {
          return [
            {
              source: "/api/:path*",
              destination: "https://etf-campus.pages.dev/api/:path*",
            },
          ];
        },
      }
    : {}),
};

export default nextConfig;

