/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    // Force Turbopack to treat this folder as the workspace root (avoids parent lockfile confusion)
    root: __dirname,
  },
};

module.exports = nextConfig;
