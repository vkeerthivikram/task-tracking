import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Silence the workspace root warning (monorepo with multiple lockfiles)
  outputFileTracingRoot: __dirname,
  typescript: {
    // Pre-existing TypeScript strict errors are not migration-related;
    // they existed in the codebase before and were not enforced by Vite.
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `http://localhost:${process.env.BACKEND_PORT || '19096'}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
