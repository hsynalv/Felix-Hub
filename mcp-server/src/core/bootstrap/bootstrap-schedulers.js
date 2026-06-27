/**
 * Connector hydration and Telegram polling after plugins load.
 * @param {typeof import("../mcp-connectors/connector.service.js").listConnectors} [listConnectorsFn]
 */
export async function bootstrapSchedulersAndConnectors(listConnectorsFn) {
  const { hydrateEnabledConnectors } = await import("../mcp-connectors/tool-bridge.js");

  try {
    const hydrated = await hydrateEnabledConnectors(listConnectorsFn);
    const ok = hydrated.filter((h) => h.ok).length;
    if (hydrated.length > 0) {
      console.log(`[mcp-connectors] Hydrated ${ok}/${hydrated.length} enabled connector(s)`);
    }
  } catch (err) {
    console.warn("[mcp-connectors] Startup hydrate failed:", err.message);
  }

  try {
    const { startTelegramPolling } = await import("../../plugins/notifications/telegram.webhook.js");
    startTelegramPolling();
  } catch (err) {
    console.warn("[telegram] Polling startup skipped:", err.message);
  }
}
