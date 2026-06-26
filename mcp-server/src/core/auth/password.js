/**
 * Password hashing via Node crypto.scrypt (no native deps).
 */

import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
const SALT_BYTES = 16;
const KEY_LEN = 64;

/**
 * @param {string} password
 * @returns {Promise<string>} encoded hash: scrypt$salt$hash (hex)
 */
export async function hashPassword(password) {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scryptAsync(password, salt, KEY_LEN);
  return `scrypt$${salt.toString("hex")}$${Buffer.from(derived).toString("hex")}`;
}

/**
 * @param {string} password
 * @param {string} encoded
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, encoded) {
  if (!encoded || !encoded.startsWith("scrypt$")) return false;
  const parts = encoded.split("$");
  if (parts.length !== 3) return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  const derived = await scryptAsync(password, salt, expected.length);
  return timingSafeEqual(Buffer.from(derived), expected);
}

export function validatePasswordPolicy(password) {
  if (typeof password !== "string" || password.length < 8) {
    return { ok: false, message: "Şifre en az 8 karakter olmalı" };
  }
  return { ok: true };
}
