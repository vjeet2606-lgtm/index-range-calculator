/**
 * Final Phase — LYNX ONE Version 1.0 (Feature Complete). Application
 * version is a plain constant (this app has no server-side version
 * endpoint to query) — bumped here and in package.json together whenever
 * a release is cut. Build Version / Commit Hash come from Vercel's own
 * build-time git env vars, re-exposed to the client bundle via
 * next.config.ts's `env` block (Vercel does not expose them to client
 * code automatically — only server-side).
 */
export const APP_VERSION = "1.0.0";

export function getBuildCommitSha(): string | undefined {
  return process.env.NEXT_PUBLIC_COMMIT_SHA || undefined;
}

export function getBuildCommitShaShort(): string | undefined {
  const sha = getBuildCommitSha();
  return sha ? sha.slice(0, 7) : undefined;
}

export function getBuildTime(): string | undefined {
  return process.env.NEXT_PUBLIC_BUILD_TIME || undefined;
}
