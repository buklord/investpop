const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  
  // Performance optimizations
  swcMinify: true,
  compress: true,
  productionBrowserSourceMaps: false,
  
  // Enable experimental features for speed
  // Note: Some experimental options may not be supported in this version
  
  webpack(config, { dev }) {
    if (dev) {
      config.watchOptions = {
        poll: 2000,
        aggregateTimeout: 300,
        ignored: ['**/node_modules'],
      };
    }
    return config;
  },
  
  onDemandEntries: {
    maxInactiveAge: 10000,
    pagesBufferLength: 2,
  },
  
  // Route-based code splitting for faster initial loads
  reactStrictMode: false, // Disable for production performance
};

module.exports = nextConfig;
