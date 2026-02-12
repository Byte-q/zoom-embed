/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  async headers() {
    return [
      {
        // Apply to ALL routes (important for Zoom)
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Content-Security-Policy",
            value: `
              default-src 'self';
              script-src 'self' 'unsafe-inline' 'unsafe-eval' https://zoom.us https://*.zoom.us https://zoom.com https://*.zoom.com https://source.zoom.us https://vercel.live https://*.stream-io-video.com;
              script-src-elem 'self' 'unsafe-inline' https://zoom.us https://*.zoom.us https://zoom.com https://*.zoom.com https://source.zoom.us;
              worker-src 'self' blob:;
              frame-src 'self' https://*.zoom.us https://zoom.us https://zoom.com https://*.zoom.com https://*.vercel.live https://vercel.live/ https://*.stream-io-video.com https://zoom-embed.vercel.app/;
              connect-src 'self' https://*.zoom.us wss://*.zoom.us https://*.stream-io-video.com https://zoom.us https://zoom.com https://vercel.live https://*.vercel.live https://source.zoom.us https://dmogdx0jrul3u.cloudfront.net https://d1cdksi819e9z7.cloudfront.net;
              img-src 'self' data: blob: https://*.zoom.us https://zoom.us https://zoom.com https://*.vercel.live https://vercel.live/ https://*.stream-io-video.com;
              style-src 'self' 'unsafe-inline';
            `.replace(/\n/g, ""),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
