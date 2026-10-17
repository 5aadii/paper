import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Every page is per-reader and dynamic, and the story page measures one read per visit,
  // so routes must render on each request and unmount when the reader leaves.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
