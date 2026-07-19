import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Generic AES-256-GCM encrypt/decrypt for cookie-stored payloads, parameterized by
 * secret so callers each supply their own env var. lib/dhan/session.ts has its own
 * copy of this same algorithm (pre-existing, tested, deliberately left untouched
 * here) — this shared version is for the new generic multi-broker credential store
 * only, to avoid risking the one broker integration that already works in
 * production while still not duplicating logic within new code.
 */
export function encryptPayload(payload: unknown, secret: string): string {
  const key = createHash("sha256").update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64url");
}

export function decryptPayload<T>(value: string, secret: string): T | undefined {
  try {
    const key = createHash("sha256").update(secret).digest();
    const raw = Buffer.from(value, "base64url");
    const iv = raw.subarray(0, 12);
    const authTag = raw.subarray(12, 28);
    const ciphertext = raw.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    return JSON.parse(plaintext) as T;
  } catch {
    return undefined;
  }
}

export function maskSecretValue(value: string): string {
  if (value.length <= 4) return "****";
  return `${"*".repeat(value.length - 4)}${value.slice(-4)}`;
}
