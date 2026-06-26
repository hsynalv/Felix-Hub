/**
 * V7 — Shopping research assistant (search, compare, cart approval gate).
 */

import { callTool, getTool } from "../tool-registry.js";
import {
  createShoppingSession,
  getShoppingSession,
  listShoppingSessions,
  updateShoppingSession,
} from "./shopping-store.js";

const BLOCKED_SHOPPING_ACTIONS = new Set([
  "checkout",
  "pay",
  "payment",
  "purchase",
  "subscribe",
  "order_complete",
]);

function parseTavilyResults(toolResult, query) {
  const data = toolResult?.data || toolResult?.result || toolResult;
  const results = data?.results || data?.items || [];
  if (!Array.isArray(results) || !results.length) return null;

  return results.slice(0, 8).map((r, i) => ({
    id: `opt-${i + 1}`,
    title: r.title || r.name || `Seçenek ${i + 1}`,
    url: r.url || r.link || "",
    snippet: (r.content || r.snippet || "").slice(0, 280),
    price: extractPrice(r.content || r.snippet || r.title || ""),
    sellerRating: null,
    shippingHint: null,
    source: "tavily",
  }));
}

function extractPrice(text) {
  const m = String(text).match(/(?:₺|TL|\$|€)\s*[\d,.]+|[\d,.]+\s*(?:₺|TL|USD|EUR)/i);
  return m ? m[0] : null;
}

function fallbackResults(query) {
  return [
    {
      id: "opt-1",
      title: `${query} — Önerilen A`,
      url: "",
      snippet: "Fiyat karşılaştırması için canlı arama yapılandırın (Tavily).",
      price: null,
      sellerRating: 4.5,
      shippingHint: "2-3 gün",
      source: "stub",
    },
    {
      id: "opt-2",
      title: `${query} — Önerilen B`,
      url: "",
      snippet: "Alternatif ürün — yorum özeti agent tarafından üretilebilir.",
      price: null,
      sellerRating: 4.2,
      shippingHint: "1-2 gün",
      source: "stub",
    },
  ];
}

async function searchWeb(query) {
  const toolName = "tavily__tavily_search";
  if (!getTool(toolName)) return null;
  try {
    const result = await callTool(
      toolName,
      { query: `${query} fiyat karşılaştırma satın al`, max_results: 8 },
      { skipAutonomyCheck: true, skipPersonalOpsCheck: true, personalScope: true }
    );
    if (result?.ok === false) return null;
    return parseTavilyResults(result, query);
  } catch {
    return null;
  }
}

export async function searchProducts(query, { persist = true } = {}) {
  const q = String(query || "").trim();
  if (!q) {
    throw Object.assign(new Error("query required"), { code: "invalid" });
  }

  const live = await searchWeb(q);
  const results = live?.length ? live : fallbackResults(q);
  const summary = buildComparisonSummary(results);

  const session = persist
    ? createShoppingSession({ query: q, results, status: "results_ready" })
    : { id: null, query: q, results, status: "results_ready" };

  return {
    sessionId: session.id,
    query: q,
    results,
    summary,
    source: live?.length ? "tavily" : "stub",
    paymentNote: "Ödeme ve sipariş tamamlama kullanıcıda — agent yapamaz.",
    generatedAt: new Date().toISOString(),
  };
}

function buildComparisonSummary(results) {
  const withPrice = results.filter((r) => r.price);
  const lines = [`${results.length} seçenek bulundu.`];
  if (withPrice.length) {
    lines.push(`Fiyatlı: ${withPrice.map((r) => `${r.title.slice(0, 40)} (${r.price})`).join("; ")}`);
  }
  const top = results[0];
  if (top) lines.push(`Öne çıkan: ${top.title}`);
  return lines.join(" ");
}

export function selectShoppingOption(sessionId, optionId) {
  const session = getShoppingSession(sessionId);
  if (!session) return { ok: false, error: { code: "not_found" } };
  const option = session.results.find((r) => r.id === optionId);
  if (!option) return { ok: false, error: { code: "invalid", message: "option not found" } };
  const updated = updateShoppingSession(sessionId, { selectedId: optionId, status: "selected" });
  return { ok: true, data: { session: updated, selected: option } };
}

export function requestCartAdd(sessionId, { optionId = null } = {}) {
  const session = getShoppingSession(sessionId);
  if (!session) return { ok: false, error: { code: "not_found" } };
  const selected = optionId || session.selectedId;
  if (!selected) {
    return { ok: false, error: { code: "invalid", message: "Select an option first" } };
  }

  const cartRequest = {
    id: `cart-${Date.now()}`,
    optionId: selected,
    status: "pending_approval",
    blockedActions: [...BLOCKED_SHOPPING_ACTIONS],
    message: "Sepete ekleme onayı bekliyor. Ödeme adımı size bırakılacak.",
    createdAt: new Date().toISOString(),
  };

  const updated = updateShoppingSession(sessionId, {
    cartRequest,
    status: "awaiting_cart_approval",
  });

  return {
    ok: true,
    data: {
      session: updated,
      cartRequest,
      requiresApproval: true,
      paymentBlocked: true,
    },
  };
}

export function approveCartRequest(sessionId) {
  const session = getShoppingSession(sessionId);
  if (!session?.cartRequest) {
    return { ok: false, error: { code: "not_found", message: "No pending cart request" } };
  }
  const cartRequest = {
    ...session.cartRequest,
    status: "approved",
    approvedAt: new Date().toISOString(),
    note: "Agent sepete ekleyebilir (simüle). Ödeme yine kullanıcıda.",
  };
  const updated = updateShoppingSession(sessionId, {
    cartRequest,
    status: "cart_approved",
  });
  return { ok: true, data: { session: updated, cartRequest } };
}

export function listRecentShoppingSessions(opts) {
  return listShoppingSessions(opts);
}
