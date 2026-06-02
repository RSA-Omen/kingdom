import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
  // Allow HMR websocket connections from remote hosts (gvdi-30 accessed by IP/hostname)
  allowedDevOrigins: ["gvdi-30", "gvdi-30.gekkosystems.local"],
};

export default nextConfig;
