import { fileURLToPath } from 'node:url';

const config = {
  outputFileTracingRoot: fileURLToPath(new URL('../../', import.meta.url)),
  transpilePackages: ['@autodev/ui', '@autodev/client-portal'],
  async rewrites() {
    const apiBase = process.env.API_URL || 'http://localhost:4000';
    return [
      { source: '/api/v1/:path*', destination: `${apiBase}/api/v1/:path*` },
      { source: '/live/:path*', destination: `${apiBase}/live/:path*` },
    ];
  },
};

export default config;