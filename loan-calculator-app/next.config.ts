// next.config.ts
import type { NextConfig } from 'next';
import withPWAInit from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  workboxOptions: {
    disableDevLogs: true,
    skipWaiting: true,
  },
});

const nextConfig: NextConfig = {
  // swcMinify is a Next.js compiler option, not a PWA option.
  // It is enabled by default in recent versions of Next.js, but explicitly setting it is fine.
  swcMinify: true, 
};

export default withPWA(nextConfig);