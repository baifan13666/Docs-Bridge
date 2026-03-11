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
  // Explicitly mark transformers and onnxruntime as external for server
  serverExternalPackages: [
    '@huggingface/transformers',
    'onnxruntime-common',
    'onnxruntime-web',
    'onnxruntime-node'
  ],
  // Note: Do NOT use output: "export" when you have API routes
  // The official tutorial uses it for client-side only apps
  webpack: (config, { isServer }) => {
    // Ignore transformers and related packages on server-side
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        '@huggingface/transformers': 'commonjs @huggingface/transformers',
        'onnxruntime-common': 'commonjs onnxruntime-common',
        'onnxruntime-web': 'commonjs onnxruntime-web',
        'onnxruntime-node': 'commonjs onnxruntime-node',
      });
    }
    
    config.resolve.alias = {
      ...config.resolve.alias,
      sharp$: false,
      "onnxruntime-node$": false,
      "onnxruntime-common$": false,
      "onnxruntime-web$": false,
    };
    return config;
  }
};

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
export default withNextIntl(nextConfig);
