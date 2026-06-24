/**
 * AES-256-GCM encryption for settings_encrypted
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 16;
const TAG_LEN = 16;

let masterKey = null;

export function initMasterKey() {
  const raw = process.env.HUB_SETTINGS_MASTER_KEY?.trim();
  if (!raw) {
    masterKey = null;
    return false;
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error("HUB_SETTINGS_MASTER_KEY must be 32 bytes (base64-encoded)");
  }
  masterKey = buf;
  return true;
}

export function isMasterKeyConfigured() {
  return masterKey !== null;
}

export function encrypt(plaintext) {
  return encryptWithKey(masterKey, plaintext, getCurrentKeyVersion());
}

export function decrypt({ ciphertext, iv, authTag }) {
  return decryptWithKey(masterKey, { ciphertext, iv, authTag });
}

let currentKeyVersion = 1;

export function getCurrentKeyVersion() {
  return currentKeyVersion;
}

export function setCurrentKeyVersion(v) {
  currentKeyVersion = v;
}

export function setMasterKeyBuffer(buf) {
  if (buf.length !== 32) {
    throw new Error("Master key must be 32 bytes");
  }
  masterKey = buf;
}

export function encryptWithKey(keyBuf, plaintext, keyVersion = 1) {
  if (!keyBuf) {
    throw Object.assign(new Error("Master key is not configured"), { code: "master_key_missing" });
  }
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, keyBuf, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext: encrypted, iv, authTag, keyVersion };
}

export function decryptWithKey(keyBuf, { ciphertext, iv, authTag }) {
  if (!keyBuf) {
    throw Object.assign(new Error("Master key is not configured"), { code: "master_key_missing" });
  }
  const decipher = createDecipheriv(ALGO, keyBuf, iv);
  decipher.setAuthTag(authTag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString("utf8");
}

export function encryptBlob(keyBuf, obj) {
  const json = JSON.stringify(obj);
  const { ciphertext, iv, authTag } = encryptWithKey(keyBuf, json, 1);
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decryptBlob(keyBuf, b64) {
  const buf = Buffer.from(b64, "base64");
  const iv = buf.subarray(0, IV_LEN);
  const authTag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = buf.subarray(IV_LEN + TAG_LEN);
  const json = decryptWithKey(keyBuf, { ciphertext, iv, authTag });
  return JSON.parse(json);
}

export function maskSecret(value) {
  if (!value || value.length < 4) return "••••••••";
  return `${value.slice(0, 2)}${"•".repeat(Math.min(8, value.length - 4))}${value.slice(-2)}`;
}
