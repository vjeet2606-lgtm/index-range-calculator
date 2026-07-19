import { cookies } from "next/headers";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { DhanCredentials } from "./types";

const COOKIE_NAME = "dhan_session";
const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60; // Dhan access tokens are valid for 24h

type SessionPayload = DhanCredentials & { connectedAt: number };

function getEncryptionKey(): Buffer {
  const secret = process.env.DHAN_SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "DHAN_SESSION_SECRET is not set. Add it to .env.local before using broker login (see .env.example).",
    );
  }
  return createHash("sha256").update(secret).digest();
}

function encrypt(payload: SessionPayload): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64url");
}

function decrypt(value: string): SessionPayload | undefined {
  try {
    const key = getEncryptionKey();
    const raw = Buffer.from(value, "base64url");
    const iv = raw.subarray(0, 12);
    const authTag = raw.subarray(12, 28);
    const ciphertext = raw.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    return JSON.parse(plaintext) as SessionPayload;
  } catch {
    return undefined;
  }
}

export async function createSession(credentials: DhanCredentials): Promise<void> {
  const payload: SessionPayload = { ...credentials, connectedAt: Date.now() };
  const store = await cookies();
  store.set(COOKIE_NAME, encrypt(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function getSession(): Promise<SessionPayload | undefined> {
  const store = await cookies();
  const cookie = store.get(COOKIE_NAME);
  if (!cookie) return undefined;

  const payload = decrypt(cookie.value);
  if (!payload) return undefined;

  const expiresAt = payload.connectedAt + SESSION_MAX_AGE_SECONDS * 1000;
  if (Date.now() > expiresAt) return undefined;

  return payload;
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export function maskClientId(clientId: string): string {
  if (clientId.length <= 4) return "****";
  return `${"*".repeat(clientId.length - 4)}${clientId.slice(-4)}`;
}
