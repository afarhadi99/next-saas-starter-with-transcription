import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    ppr: true,
    serverActions: {
      bodySizeLimit: '150mb', // Increase the limit to 50MB
    },
  },
};

export default nextConfig;
