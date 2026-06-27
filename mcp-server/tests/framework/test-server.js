/**
 * Shared integration server singleton — avoids N× createServer() per test file.
 */

import { createServer } from "../../src/core/server.js";

/** @type {Promise<import('express').Express>|null} */
let appPromise = null;
/** @type {Promise<import('express').Express>|null} */
let createLock = null;
/** @type {string|null} */
let envFingerprint = null;

function hubEnvFingerprint() {
  return [
    process.env.HUB_READ_KEY,
    process.env.HUB_WRITE_KEY,
    process.env.HUB_ADMIN_KEY,
    process.env.HUB_ALLOW_OPEN_HUB,
    process.env.NODE_ENV,
  ].join("|");
}

/**
 * @returns {Promise<import('express').Express>}
 */
export function getIntegrationServer() {
  const fp = hubEnvFingerprint();
  if (appPromise && envFingerprint !== fp) {
    appPromise = null;
    createLock = null;
  }
  envFingerprint = fp;

  if (appPromise) return appPromise;

  if (!createLock) {
    const savedGithubToken = process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_TOKEN;

    createLock = createServer()
      .then((app) => {
        appPromise = app;
        return app;
      })
      .finally(() => {
        if (savedGithubToken) process.env.GITHUB_TOKEN = savedGithubToken;
        createLock = null;
      });
  }

  return createLock;
}

export async function resetIntegrationServer() {
  appPromise = null;
  createLock = null;
  envFingerprint = null;
}
