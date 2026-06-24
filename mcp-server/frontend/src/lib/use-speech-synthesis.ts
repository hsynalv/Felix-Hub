import { useCallback, useEffect, useState } from "react";

const TTS_KEY = "mcpHubVoiceTts";

export function getTtsEnabled(): boolean {
  try {
    return localStorage.getItem(TTS_KEY) === "true";
  } catch {
    return false;
  }
}

export function setTtsEnabled(enabled: boolean) {
  try {
    localStorage.setItem(TTS_KEY, enabled ? "true" : "false");
  } catch {
    /* ignore */
  }
}

export function useSpeechSynthesis() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(getTtsEnabled);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      setTtsEnabled(next);
      return next;
    });
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!enabled || !supported || !text.trim()) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text.slice(0, 4000));
      utter.lang = navigator.language || "tr-TR";
      utter.rate = 1;
      window.speechSynthesis.speak(utter);
    },
    [enabled, supported]
  );

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
  }, []);

  return { supported, enabled, toggle, speak, stop };
}
