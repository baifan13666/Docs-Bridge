import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
        pathname: '/**',
      },
    ],
  },
  // Configure webpack for @xenova/transformers deployment (Context7 recommended)
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "sharp$": false,
      "onnxruntime-node$": false,
    };
    
    // Don't externalize sharp on server to prevent loading issues
    if (isServer) {
      config.externals = config.externals || [];
      // Remove sharp from externals if it exists
      config.externals = config.externals.filter((external: any) => {
        if (typeof external === 'string') {
          return external !== 'sharp';
        }
        return true;
      });
    }
    
    return config;
  },
  // Indicate that these packages should not be bundled by webpack for server components
  // Based on Context7 Transformers.js documentation
  serverExternalPackages: ['onnxruntime-node', '@xenova/transformers'],
};

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
export default withNextIntl(nextConfig);
