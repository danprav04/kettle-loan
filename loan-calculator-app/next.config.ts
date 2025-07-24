// next.config.ts
import type { NextConfig } from 'next';
import withPWAInit from '@ducanh2912/next-pwa';

// Define the runtime caching strategies for the service worker.
const runtimeCaching = [
  {
    urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
    handler: 'CacheFirst' as const,
    options: {
      cacheName: 'google-fonts',
      expiration: {
        maxEntries: 4,
        maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
      },
    },
  },
  {
    urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css|jpg|jpeg|gif|png|svg|ico|webp)$/i,
    handler: 'StaleWhileRevalidate' as const,
    options: {
      cacheName: 'static-assets',
      expiration: {
        maxEntries: 64,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      },
    },
  },
  // Corrected API Caching Rule:
  // Use 'NetworkFirst' because we are using 'networkTimeoutSeconds'.
  // This tries the network first, gets the latest data, but falls back to the cache
  // if offline or if the network is too slow (takes longer than 10 seconds).
  {
    urlPattern: /^\/api\/.*/i,
    handler: 'NetworkFirst' as const, // Changed from StaleWhileRevalidate to NetworkFirst
    method: 'GET' as const,
    options: {
      cacheName: 'api-cache',
      expiration: {
        maxEntries: 64,
        maxAgeSeconds: 24 * 60 * 60, // 1 day
      },
      // This option is only valid for 'NetworkFirst'
      networkTimeoutSeconds: 10,
    },
  },
  {
    urlPattern: ({ request, url }: { request: Request; url: URL }) => {
      if (request.destination !== 'document') return false;
      if (url.pathname.startsWith('/api/')) return false;
      return true;
    },
    handler: 'NetworkFirst' as const,
    options: {
      cacheName: 'pages-cache',
      expiration: {
        maxEntries: 32,
        maxAgeSeconds: 24 * 60 * 60, // 1 day
      },
    },
  },
];

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
    runtimeCaching,
  },
});

// The `swcMinify` option has been removed as it's default in recent Next.js versions.
const nextConfig: NextConfig = {};

export default withPWA(nextConfig);