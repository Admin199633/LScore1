/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "next-auth",
    "@vercel/speed-insights"
  ],
  basePath: "/green",
};

export default nextConfig;
