// next.config.ts
import type { NextConfig } from 'next';
import withPWAInit from '@ducanh2912/next-pwa';

// Validation: Ensure the VAPID key is present during build time.
// If this logs "Missing" in your GitHub Action logs, check your Repository Secrets.
if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
  console.warn('⚠️ WARNING: NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing at build time. Push notifications will fail.');
} else {
  console.log('✅ NEXT_PUBLIC_VAPID_PUBLIC_KEY is present in build environment.');
}

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
    urlPattern: ({ url }: { url: URL }) => {
      // Exclude API routes and internal Next.js files from page caching
      return !url.pathname.startsWith('/api/') && !url.pathname.startsWith('/_next/static/');
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
  cacheStartUrl: false, // Fix for "_ref is not defined"
  workboxOptions: {
    disableDevLogs: true,
    skipWaiting: true,
    runtimeCaching,
    importScripts: ['/push-sw.js'],
    // Fix for "bad-precaching-response" (404 errors):
    // Exclude Next.js build manifests and middleware manifests from the precache list.
    exclude: [
      /_buildManifest\.js$/,
      /_ssgManifest\.js$/,
      /_middlewareManifest\.js$/,
      /middleware-manifest\.json$/,
      /build-manifest\.json$/
    ],
  },
  fallbacks: {
    document: "/~offline",
  },
});

const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: {},
  // Explicitly bake the environment variable into the build
  env: {
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  },
};

export default withPWA(nextConfig);