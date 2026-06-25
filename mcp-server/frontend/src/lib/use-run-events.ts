import { useEffect, useRef, useState } from "react";
import { getApiKey } from "./auth";
import { getProjectHeaders } from "./workspace-context-store";

export interface RunEventPayload {
  runId?: string;
  type?: string;
  status?: string;
  step?: unknown;
  ts?: string;
  [key: string]: unknown;
}

export function useRunEvents(runId: string | null, enabled = true) {
  const [lastEvent, setLastEvent] = useState<RunEventPayload | null>(null);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!runId || !enabled) {
      setConnected(false);
      return;
    }

    const key = getApiKey();
    const headers = getProjectHeaders();
    const qs = new URLSearchParams(headers);
    if (key) qs.set("access_token", key);

    const es = new EventSource(`/runs/${runId}/events?${qs}`);
    esRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    const handle = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data) as RunEventPayload;
        setLastEvent({ ...data, _event: ev.type });
      } catch {
        /* ignore */
      }
    };

    es.addEventListener("meta", handle);
    es.addEventListener("step", handle);
    es.addEventListener("status", handle);
    es.addEventListener("event", handle);
    es.addEventListener("ping", () => setConnected(true));

    return () => {
      es.close();
      esRef.current = null;
      setConnected(false);
    };
  }, [runId, enabled]);

  return { lastEvent, connected };
}
