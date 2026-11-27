import type { NextConfig } from "next";

const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["192.168.*.*"], // lets other machines on the LAN load the dev server by IP
  cacheComponents: true,
  partialPrefetching: true,
  experimental: { serverActions: { bodySizeLimit: "8mb" } }, // company file uploads are capped at 7 MB
  async headers() {
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
