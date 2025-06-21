import type { NextConfig } from "next";
import withNextIntl from 'next-intl/plugin';

// Point the plugin to your i18n configuration file.
const withIntl = withNextIntl('./src/i18n.ts');

const nextConfig: NextConfig = {
  /* config options here */
};

export default withIntl(nextConfig);