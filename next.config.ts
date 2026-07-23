import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Final Phase — Application Health diagnostics page needs a Commit Hash
  // and Build Version. Vercel sets VERCEL_GIT_COMMIT_SHA server-side at
  // build time but does not expose it to client code automatically; this
  // block re-exposes it (and a build timestamp) under NEXT_PUBLIC_* so
  // lib/version.ts can read them client-side. Empty string, not undefined,
  // when building outside Vercel (e.g. local `next build`) — the health
  // page treats an empty value as "not available," never fabricated.
  env: {
    NEXT_PUBLIC_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? "",
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
};

export default nextConfig;
