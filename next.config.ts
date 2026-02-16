import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Force Turbopack to treat this folder as the workspace root (avoids parent lockfile confusion)
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
