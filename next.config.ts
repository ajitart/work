import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// The site is published on GitHub Pages at ajitart.github.io/work.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/work";

const nextConfig: NextConfig = {
  // Static export for GitHub Pages. In dev it stays a normal server so the Studio API can write files.
  output: isDev ? undefined : "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  // Files named *.dev.ts(x) (the Studio page and its upload API) exist only
  // while running `next dev`. They are never part of the published site.
  pageExtensions: isDev ? ["dev.tsx", "dev.ts", "tsx", "ts"] : ["tsx", "ts"],
};

export default nextConfig;
