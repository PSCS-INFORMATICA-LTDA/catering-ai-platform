import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer"],
  images: {
    qualities: [75, 90],
  },
  outputFileTracingIncludes: {
    "/api/quotes/[id]/pdf": ["./public/cdl/logo.png"],
  },
};

export default nextConfig;
