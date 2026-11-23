import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["192.168.1.6"],
  experimental: { authInterrupts: true },
};
export default nextConfig;
