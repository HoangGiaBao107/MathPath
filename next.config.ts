import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  outputFileTracingExcludes: {
    "/*": ["./content/extracted/**/*", "./content/source-pdfs/**/*", "./*.pdf"],
  },
};

export default nextConfig;
