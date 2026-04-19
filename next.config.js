/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Note: apiTimeout requires Vercel Pro plan for functions >10s
  serverRuntimeConfig: {
    apiTimeout: 25000,
  },
}

module.exports = nextConfig
