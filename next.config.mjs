/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "next-auth",
    "@vercel/speed-insights"
  ],
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/green",
          destination: "https://greenproject-two.vercel.app/green",
        },
        {
          source: "/green/:path*",
          destination: "https://greenproject-two.vercel.app/green/:path*",
        },
      ],
    };
  },
};

export default nextConfig;