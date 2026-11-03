import "dotenv/config";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION_PREFIX = "enc:v1:";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
let cachedKey;

function getEncryptionKey() {
  if (cachedKey) return cachedKey;

  const configuredKey = process.env.NOTES_ENCRYPTION_KEY?.trim();
  if (!configuredKey) {
    throw new Error(
      "NOTES_ENCRYPTION_KEY is required. Generate a key with: openssl rand -base64 32",
    );
  }

  const key = /^[\da-f]{64}$/i.test(configuredKey)
    ? Buffer.from(configuredKey, "hex")
    : Buffer.from(configuredKey, "base64");

  if (key.length !== 32) {
    throw new Error("NOTES_ENCRYPTION_KEY must be 32 bytes in base64 or 64 hexadecimal characters");
  }

  cachedKey = key;
  return cachedKey;
}

export function assertNoteEncryptionKey() {
  getEncryptionKey();
}

export function isEncryptedNote(value) {
  return typeof value === "string" && value.startsWith(VERSION_PREFIX);
}

export function encryptNote(plaintext) {
  if (typeof plaintext !== "string") {
    throw new TypeError("Note text must be a string before encryption");
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return [
    VERSION_PREFIX.slice(0, -1),
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decryptNote(value) {
  if (!isEncryptedNote(value)) return value;

  const [version, versionNumber, encodedIv, encodedTag, encodedCiphertext, ...extra] = value.split(":");
  if (
    version !== "enc" ||
    versionNumber !== "v1" ||
    encodedIv === undefined ||
    encodedTag === undefined ||
    encodedCiphertext === undefined ||
    extra.length
  ) {
    throw new Error("Stored note has an invalid encrypted format");
  }

  const iv = Buffer.from(encodedIv, "base64");
  const authTag = Buffer.from(encodedTag, "base64");
  const ciphertext = Buffer.from(encodedCiphertext, "base64");
  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Stored note has an invalid encrypted format");
  }

  try {
    const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Could not decrypt note; verify NOTES_ENCRYPTION_KEY and stored note data");
  }
}
