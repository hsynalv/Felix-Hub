/**
 * Inbox SSE pub/sub.
 */

import { EventEmitter } from "events";

const bus = new EventEmitter();
bus.setMaxListeners(50);

export function subscribeInboxEvents(listener) {
  bus.on("inbox", listener);
  return () => bus.off("inbox", listener);
}

export function emitInboxUpdate(payload = {}) {
  bus.emit("inbox", { ts: new Date().toISOString(), ...payload });
}

export function resetInboxEventsForTests() {
  bus.removeAllListeners();
}
