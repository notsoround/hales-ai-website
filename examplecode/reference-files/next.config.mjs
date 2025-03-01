/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  webpack: (config, { isServer }) => {
    // Fixes npm packages that depend on `fs` module
    if (!isServer) {
      config.resolve.fallback = {
        fs: false,
      };
    }
    return config;
  },
  async headers() {
    return [
      {
        source: '/realtime-chat',
        headers: [
          { key: 'Upgrade', value: 'websocket' },
          { key: 'Connection', value: 'Upgrade' }
        ]
      }
    ];
  },
  async redirects() {
    return [
      {
        source: '/Realtime_chatgpt_jan2025',
        destination: '/realtime-chat',
        permanent: true,
      },
      {
        source: '/realtime-chatgpt-jan2025',
        destination: '/realtime-chat',
        permanent: true,
      }
    ];
  },
};
export default nextConfig;
