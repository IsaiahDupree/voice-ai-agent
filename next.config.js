/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // F0972: API timeout - API routes timeout after 30s
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
      allowedOrigins: ['localhost:3000'],
    },
  },
  // API routes max duration (30 seconds for all API routes)
  // This is enforced at the Edge/Vercel platform level
  serverRuntimeConfig: {
    apiTimeout: 30000, // 30 seconds
  },
  headers: async () => {
    return [
      {
        source: '/:path*',
        headers: [
          // F1183: OWASP recommended security headers
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(), microphone=(), camera=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.vapi.ai; style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.vapi.ai https://api.calcom.dev https://api.twilio.com https://api.deepgram.com https://api.elevenlabs.io https://ivhfuhxorppptyuofbgq.supabase.co; img-src 'self' data: https:; font-src 'self' data:",
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
