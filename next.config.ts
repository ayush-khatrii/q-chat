import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // The compiler API avoids a Node 24 detached-CLI output bug during builds.
    useTypeScriptCli: false,
  },
};

export default nextConfig;
