import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  // Standalone solo en imagen Docker (NEXT_OUTPUT=standalone)
  ...(process.env.NEXT_OUTPUT === 'standalone' ? { output: 'standalone' as const } : {}),
  // Evita que Next tome el lockfile del monorepo cuando hay package-lock local (publish).
  outputFileTracingRoot: path.join(__dirname),
  transpilePackages: ['@onix/ui', '@onix/db', '@onix/engine', '@onix/templates', '@onix/agent'],
  serverExternalPackages: ['@electric-sql/pglite'],
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb',
    },
  },
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@repo-root': path.resolve(__dirname, '../..'),
    };
    if (isServer) {
      const prev = config.externals;
      config.externals = [
        ...(Array.isArray(prev) ? prev : prev ? [prev] : []),
        '@electric-sql/pglite',
        '@electric-sql/pglite/node',
      ];
    }
    return config;
  },
};

export default nextConfig;
