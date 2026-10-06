import { fileURLToPath } from 'node:url';
const config = { outputFileTracingRoot: fileURLToPath(new URL('../../', import.meta.url)), transpilePackages: ['@autodev/ui', '@autodev/client-portal'] }; export default config;
