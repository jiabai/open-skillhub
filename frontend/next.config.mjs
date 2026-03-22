/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // 图片优化配置
  images: {
    unoptimized: true
  },

  // 开发服务器配置
  devIndicators: {
    appIsrStatus: false
  },

  // 禁用 x-powered-by 头
  poweredByHeader: false
}

export default nextConfig
