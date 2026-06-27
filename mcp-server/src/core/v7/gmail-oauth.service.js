/**
 * V7 — Gmail OAuth for briefing (read-only).
 * Requires: GMAIL_OAUTH_CLIENT_ID, GMAIL_OAUTH_CLIENT_SECRET
 */

import { randomUUID } from "crypto";
import { google } from "googleapis";

const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];
const pendingStates = new Map();
const STATE_TTL_MS = 15 * 60_000;

export function isGmailOAuthConfigured() {
  return !!(process.env.GMAIL_OAUTH_CLIENT_ID && process.env.GMAIL_OAUTH_CLIENT_SECRET);
}

export function getGmailOAuthRedirectUri() {
  return (
    process.env.GMAIL_OAUTH_REDIRECT_URI ||
    `http://localhost:${process.env.PORT || 8787}/personal/briefing/gmail/oauth/callback`
  );
}

function prunePendingStates() {
  const now = Date.now();
  for (const [state, meta] of pendingStates.entries()) {
    if (now - meta.createdAt > STATE_TTL_MS) pendingStates.delete(state);
  }
}

export function createOAuth2Client() {
  const clientId = process.env.GMAIL_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GMAIL_OAUTH_CLIENT_ID and GMAIL_OAUTH_CLIENT_SECRET are required");
  }
  return new google.auth.OAuth2(clientId, clientSecret, getGmailOAuthRedirectUri());
}

export function createGmailOAuthState() {
  prunePendingStates();
  const state = randomUUID();
  pendingStates.set(state, { createdAt: Date.now() });
  return state;
}

export function consumeGmailOAuthState(state) {
  prunePendingStates();
  if (!state || !pendingStates.has(state)) return false;
  pendingStates.delete(state);
  return true;
}

export function getGmailAuthUrl() {
  const client = createOAuth2Client();
  const state = createGmailOAuthState();
  const url = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GMAIL_SCOPES,
    state,
  });
  return { url, state };
}

/**
 * @param {string} code
 */
export async function exchangeGmailOAuthCode(code) {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error("No refresh_token returned — revoke prior access and retry with consent");
  }
  client.setCredentials(tokens);
  const gmail = google.gmail({ version: "v1", auth: client });
  const profile = await gmail.users.getProfile({ userId: "me" });
  return {
    email: profile.data.emailAddress,
    refreshToken: tokens.refresh_token,
  };
}

/**
 * @param {{ refreshToken: string }} account
 */
export function createGmailClientForAccount(account) {
  const client = createOAuth2Client();
  client.setCredentials({ refresh_token: account.refreshToken });
  return google.gmail({ version: "v1", auth: client });
}
