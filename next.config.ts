import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["192.168.*.*"], // lets other machines on the LAN load the dev server by IP
  cacheComponents: true,
  partialPrefetching: true,
  experimental: { serverActions: { bodySizeLimit: "6mb" } }, // company file uploads are capped at 5 MB
};

export default nextConfig;
