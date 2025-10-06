import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'replicate.delivery'
      },
      {
        protocol: 'https',
        hostname: 'image.tmdb.org'
      },
      {
        protocol: 'https',
        hostname: 'agws.app'
      }
    ]
  },
  basePath: '/oldschoolfaces'
};

export default nextConfig;
