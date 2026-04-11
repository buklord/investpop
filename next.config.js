const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  
  // Performance optimizations
  swcMinify: true,
  compress: true,
  productionBrowserSourceMaps: false,
  
  // Response compression
  headers: async () => {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Content-Encoding',
            value: 'gzip',
          },
        ],
      },
    ]
  },
  
  // Enable experimental features for speed
  experimental: {
    isrMemoryCacheSize: 52 * 1024 * 1024, // 52MB cache
    turbopack: false, // Use SWC for faster builds
  },
  
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
