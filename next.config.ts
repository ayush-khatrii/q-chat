import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Instant Navigation: makes routes render a static App Shell first and
  // stream the user-specific parts in behind their nearest <Suspense>.
  cacheComponents: true,
  experimental: {
    // Renders a partial fallback shell for cache-components routes so client
    // navigations can commit the shell immediately instead of blocking.
    partialFallbacks: true,
    // Adds the Instant Navigation Mode toggle to the dev tools indicator.
    instantNavigationDevToolsToggle: true,
  },
};

export default nextConfig;
