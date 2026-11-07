import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // minimal Docker image (see Dockerfile)
  cacheComponents: true,
  partialPrefetching: true,
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
