import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Static export for S3/CloudFront deployment
  output: 'export',
  // Disable image optimization (not supported in static export)
  images: { unoptimized: true },
  // Trailing slash for S3 compatibility
  trailingSlash: true,
};

export default nextConfig;
