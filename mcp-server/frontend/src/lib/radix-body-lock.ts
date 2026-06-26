/**
 * Radix Dialog/Sheet bazen unmount sırasında body kilidini bırakmıyor.
 * Route geçişlerinde tıklamaları ve outlet swap'ını bozuyor.
 */
export function releaseRadixBodyLock() {
  if (typeof document === "undefined") return;
  document.body.style.pointerEvents = "";
  document.body.style.overflow = "";
  document.body.removeAttribute("data-scroll-locked");
}

export const PREPARE_NAVIGATION_EVENT = "mcp:prepare-navigation";

export function dispatchPrepareNavigation() {
  if (typeof window === "undefined") return;
  releaseRadixBodyLock();
  window.dispatchEvent(new CustomEvent(PREPARE_NAVIGATION_EVENT));
}
