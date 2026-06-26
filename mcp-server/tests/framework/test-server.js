/**
 * Shared integration server singleton — avoids N× createServer() per test file.
 */

import { createServer } from "../../src/core/server.js";

/** @type {Promise<import('express').Express>|null} */
let appPromise = null;
/** @type {Promise<import('express').Express>|null} */
let createLock = null;

/**
 * @returns {Promise<import('express').Express>}
 */
export function getIntegrationServer() {
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
}
