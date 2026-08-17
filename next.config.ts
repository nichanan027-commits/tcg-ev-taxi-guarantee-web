import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return {
      // หน้าหลัก "/" เสิร์ฟไฟล์ Route2Own Front Office (public/route2own.html) โดยตรง
      beforeFiles: [{ source: "/", destination: "/route2own.html" }],
      afterFiles: [],
      fallback: []
    };
  }
};

export default nextConfig;
