// types/next-pwa.d.ts
declare module 'next-pwa' {
  import { NextConfig } from 'next';

  // Define the options for next-pwa based on its documentation
  interface PWAConfig {
    dest?: string;
    register?: boolean;
    skipWaiting?: boolean;
    disable?: boolean;
    sw?: string;
    // Add other next-pwa options here as you use them
  }

  // Define the function signature for the default export
  function withPWA(config: PWAConfig): (nextConfig: NextConfig) => NextConfig;

  export = withPWA;
}