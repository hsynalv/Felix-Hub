/**
 * Shared integration server singleton — avoids N× createServer() per test file.
 */

import { createServer } from "../../src/core/server.js";

/** @type {Promise<import('express').Express>|null} */
let appPromise = null;

/**
 * @returns {Promise<import('express').Express>}
 */
export function getIntegrationServer() {
  if (!appPromise) {
    appPromise = createServer();
  }
  return appPromise;
}

export async function resetIntegrationServer() {
  appPromise = null;
}
