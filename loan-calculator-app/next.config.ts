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
    // Simplified function with explicit type to satisfy TypeScript
    urlPattern: ({ url }: { url: URL }) => {
      return !url.pathname.startsWith('/api/');
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
  // Disable buggy start-url caching to fix "_ref is not defined" error
  cacheStartUrl: false,
  workboxOptions: {
    disableDevLogs: true,
    skipWaiting: true,
    runtimeCaching,
    importScripts: ['/push-sw.js'],
    // Fix for "bad-precaching-response": Exclude build manifests from precache
    exclude: [/_buildManifest\.js$/, /_ssgManifest\.js$/],
  },
  fallbacks: {
    document: "/~offline",
  },
});

const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: {},
  // Ensure the public key is explicitly exposed to the build environment
  env: {
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  },
};

export default withPWA(nextConfig);