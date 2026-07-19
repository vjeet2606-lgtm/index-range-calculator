import { cookies } from "next/headers";
import { encryptPayload, decryptPayload } from "@/lib/security/credentialCipher";
import type { BrokerCredentials } from "./types";

const COOKIE_PREFIX = "lynx_broker_";
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days — credentials, not a live session token

type StoredCredentials = {
  brokerId: string;
  credentials: BrokerCredentials;
  savedAt: number;
  lastVerifiedAt?: number;
};

function getSecret(): string {
  const secret = process.env.BROKER_CREDENTIALS_SECRET;
  if (!secret) {
    throw new Error(
      "BROKER_CREDENTIALS_SECRET is not set. Add it to .env.local before saving broker credentials (see .env.example).",
    );
  }
  return secret;
}

function cookieName(brokerId: string): string {
  return `${COOKIE_PREFIX}${brokerId}`;
}

/** Saves a broker's credentials, httpOnly + AES-256-GCM encrypted. Never returned to client JS. */
export async function saveCredentials(brokerId: string, credentials: BrokerCredentials): Promise<void> {
  const payload: StoredCredentials = { brokerId, credentials, savedAt: Date.now() };
  const store = await cookies();
  store.set(cookieName(brokerId), encryptPayload(payload, getSecret()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function getCredentials(brokerId: string): Promise<StoredCredentials | undefined> {
  const store = await cookies();
  const cookie = store.get(cookieName(brokerId));
  if (!cookie) return undefined;
  return decryptPayload<StoredCredentials>(cookie.value, getSecret());
}

export async function markVerified(brokerId: string): Promise<void> {
  const existing = await getCredentials(brokerId);
  if (!existing) return;
  const store = await cookies();
  store.set(
    cookieName(brokerId),
    encryptPayload({ ...existing, lastVerifiedAt: Date.now() }, getSecret()),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE_SECONDS,
    },
  );
}

export async function deleteCredentials(brokerId: string): Promise<void> {
  const store = await cookies();
  store.delete(cookieName(brokerId));
}

/** Every brokerId with saved credentials in the current request's cookies. */
export async function listSavedBrokerIds(): Promise<string[]> {
  const store = await cookies();
  return store
    .getAll()
    .map((c) => c.name)
    .filter((name) => name.startsWith(COOKIE_PREFIX))
    .map((name) => name.slice(COOKIE_PREFIX.length));
}
