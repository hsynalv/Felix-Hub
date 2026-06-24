/**
 * Settings crypto unit tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { randomBytes } from "crypto";
import {
  setMasterKeyBuffer,
  encrypt,
  decrypt,
  encryptWithKey,
  decryptWithKey,
  encryptBlob,
  decryptBlob,
  maskSecret,
  initMasterKey,
  isMasterKeyConfigured,
} from "../../src/core/settings/crypto.js";

describe("settings/crypto", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
    delete process.env.HUB_SETTINGS_MASTER_KEY;
  });

  beforeEach(() => {
    delete process.env.HUB_SETTINGS_MASTER_KEY;
  });

  it("encrypt/decrypt round-trip with master key", () => {
    const key = randomBytes(32);
    setMasterKeyBuffer(key);
    const payload = encrypt("hello-secret");
    const plain = decrypt(payload);
    expect(plain).toBe("hello-secret");
  });

  it("encrypt throws when master key missing", () => {
    delete process.env.HUB_SETTINGS_MASTER_KEY;
    initMasterKey();
    expect(() => encrypt("x")).toThrow(/master key/i);
  });

  it("setMasterKeyBuffer rejects wrong key length", () => {
    expect(() => setMasterKeyBuffer(Buffer.alloc(16))).toThrow(/32 bytes/);
  });

  it("decrypt fails with tampered auth tag", () => {
    const key = randomBytes(32);
    const payload = encryptWithKey(key, "data", 1);
    const badTag = Buffer.from(payload.authTag);
    badTag[0] ^= 0xff;
    expect(() => decryptWithKey(key, { ...payload, authTag: badTag })).toThrow();
  });

  it("encryptBlob/decryptBlob round-trip", () => {
    const key = randomBytes(32);
    const blob = encryptBlob(key, { foo: "bar", n: 1 });
    expect(decryptBlob(key, blob)).toEqual({ foo: "bar", n: 1 });
  });

  it("initMasterKey accepts valid base64 32-byte key", () => {
    const raw = randomBytes(32).toString("base64");
    process.env.HUB_SETTINGS_MASTER_KEY = raw;
    expect(initMasterKey()).toBe(true);
    expect(isMasterKeyConfigured()).toBe(true);
    expect(encrypt("ok")).toBeTruthy();
  });

  it("initMasterKey throws on invalid key length", () => {
    process.env.HUB_SETTINGS_MASTER_KEY = Buffer.from("short").toString("base64");
    expect(() => initMasterKey()).toThrow(/32 bytes/);
  });

  it("maskSecret redacts middle of value", () => {
    expect(maskSecret("abcdefghij")).toMatch(/^ab•+ij$/);
    expect(maskSecret("ab")).toBe("••••••••");
  });
});
