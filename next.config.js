/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  webpack(config) {
    config.experiments = { ...config.experiments, topLevelAwait: true };
    return config;
  },
};

export default nextConfig;
// If the 'type' property in the package.json file is set to 'commonjs', use 'module.exports = nextConfig;' instead of 'export default nextConfig;'.