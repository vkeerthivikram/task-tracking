import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Pre-existing TypeScript strict errors are not migration-related; they existed
// before and were not enforced by Vite. Set NEXT_IGNORE_BUILD_ERRORS=true to
// suppress them (e.g. during the migration transition period).
const shouldIgnoreTypeErrors = process.env.NEXT_IGNORE_BUILD_ERRORS === 'true';

// Backend connection configuration
// - Local development: uses localhost (default)
// - Docker: set BACKEND_HOST=backend (Docker service name)
const backendHost = process.env.BACKEND_HOST || 'localhost';
const backendPort = process.env.BACKEND_PORT || '19096';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Silence the workspace root warning (monorepo with multiple lockfiles)
  outputFileTracingRoot: __dirname,
  // Hide the dev indicator (flame icon) by default
  devIndicators: false,
  // Enable standalone output for Docker
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: shouldIgnoreTypeErrors,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `http://${backendHost}:${backendPort}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
