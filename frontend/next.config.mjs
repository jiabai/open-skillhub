/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',

  images: {
    unoptimized: true
  },

  devIndicators: {
    appIsrStatus: false
  },

  poweredByHeader: false,

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_INTERNAL_URL || 'http://api:8001'}/api/:path*`
      }
    ]
  }
}

export default nextConfig
