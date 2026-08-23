import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer"],
  images: {
    qualities: [75, 90],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'yasprgtlqclwsjcshtls.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  outputFileTracingIncludes: {
    "/api/quotes/[id]/pdf": ["./public/cdl/logo.png"],
  },
};

export default nextConfig;
