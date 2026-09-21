import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Application-level encryption for third-party tokens stored in the database
// (Google OAuth tokens, a client's Apify API token). Without it a database
// backup, a leaked read-only credential, or anyone with dashboard access reads
// them as plain text. AES-256-GCM: authenticated, so a tampered or wrong-key
// value fails loudly instead of decrypting to garbage.
//
// Deliberately backward compatible so turning it on can't break a working
// connection:
//  - no TOKEN_ENCRYPTION_KEY set  -> values are stored exactly as before
//  - a stored value without the "enc:v1:" prefix is legacy plain text and is
//    returned as-is, so tokens saved before the key existed keep working
//  - only NEWLY written tokens (a fresh connect, or a Google token refresh)
//    become encrypted; reconnecting re-encrypts an old one
const PREFIX = "enc:v1:";
const IV_BYTES = 12;
const TAG_BYTES = 16;

const deriveKey = (secret: string) => createHash("sha256").update(secret).digest();

export function isEncrypted(stored: string): boolean {
  return stored.startsWith(PREFIX);
}

export function encryptSecret(plain: string, secret: string | undefined = process.env.TOKEN_ENCRYPTION_KEY): string {
  if (!secret?.trim()) return plain;
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret.trim()), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}

export function decryptSecret(stored: string, secret: string | undefined = process.env.TOKEN_ENCRYPTION_KEY): string {
  if (!isEncrypted(stored)) return stored; // legacy plain text
  if (!secret?.trim()) {
    throw new Error("A stored token is encrypted but TOKEN_ENCRYPTION_KEY is not set on this deployment.");
  }
  try {
    const raw = Buffer.from(stored.slice(PREFIX.length), "base64");
    const decipher = createDecipheriv("aes-256-gcm", deriveKey(secret.trim()), raw.subarray(0, IV_BYTES));
    decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    return Buffer.concat([decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("A stored token could not be decrypted — TOKEN_ENCRYPTION_KEY is wrong, or the value was altered.");
  }
}

// For read paths where a token that can't be decrypted should behave like "not
// connected" (prompting a reconnect) rather than crash the page.
export function tryDecryptSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  try {
    return decryptSecret(stored);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    return null;
  }
}
