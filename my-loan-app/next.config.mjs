// FILE: next.config.mjs
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin(
  // Path to your i18n configuration file.
  // This is the default location, so it's explicit here for clarity.
  './i18n.ts'
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // You can add other Next.js specific configurations here if needed.
  // For example:
  // reactStrictMode: true,
  //
  // Note on allowedDevOrigins for the cross-origin warning you see:
  // If you want to explicitly allow access from your local network IP
  // (e.g., http://192.168.1.15:3000) to resources like _next/*,
  // you might consider adding it here in a future Next.js version
  // once the "allowedDevOrigins" feature is stable.
  // For now, this warning is informational for development.
  // experimental: {
  //   allowedDevOrigins: ["http://192.168.1.15:3000"],
  // },
};

export default withNextIntl(nextConfig);