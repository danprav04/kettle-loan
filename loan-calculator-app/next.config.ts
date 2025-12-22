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
  {
    urlPattern: /^\/api\/.*/i,
    handler: 'NetworkFirst' as const,
    method: 'GET' as const,
    options: {
      cacheName: 'api-cache',
      expiration: {
        maxEntries: 64,
        maxAgeSeconds: 24 * 60 * 60, // 1 day
      },
      networkTimeoutSeconds: 10,
    },
  },
  {
    urlPattern: ({ request, url }: { request: Request; url: URL }) => {
      if (url.pathname.startsWith('/api/')) return false;
      return request.method === 'GET';
    },
    handler: 'NetworkFirst' as const,
    options: {
      cacheName: 'pages-cache',
      expiration: {
        maxEntries: 32,
        maxAgeSeconds: 24 * 60 * 60, // 1 day
      },
      networkTimeoutSeconds: 10,
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
    // Import the custom push notification service worker
    importScripts: ['/push-sw.js'],
  },
  fallbacks: {
    document: "/~offline",
  },
});

const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: {},
};

export default withPWA(nextConfig);