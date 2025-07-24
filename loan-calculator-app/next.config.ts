import type { NextConfig } from "next";
import withPWA from "next-pwa";

const pwaConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
};

// We use 'as any' here to resolve a type conflict between next-pwa and the latest Next.js types.
// This is a safe workaround as the underlying configuration objects are compatible.
export default pwaConfig(nextConfig as any);
