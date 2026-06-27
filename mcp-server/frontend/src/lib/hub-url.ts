import { BRAND } from "@/lib/branding";

/** Current hub origin (localhost or deployed domain). */
export function getHubOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "http://localhost:8787";
}

export function isLocalHub(): boolean {
  if (typeof window === "undefined") return true;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

export function hubUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${getHubOrigin()}${p}`;
}

export function hubLabel(): string {
  return isLocalHub() ? "localhost (geliştirme)" : getHubOrigin().replace(/^https?:\/\//, "");
}

export function productionHubUrl(): string {
  return BRAND.productionUrl;
}
