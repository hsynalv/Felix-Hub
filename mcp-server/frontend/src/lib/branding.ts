/** Product branding — keep in sync with src/core/branding.js */

export const BRAND = {
  hubName: "Felix Hub",
  assistantName: "Felix",
  desktopAgentName: "Felix Desktop",
  cliName: "Felix CLI",
  authorName: "Hüseyin Alav",
  productionUrl: "https://asistan.huseyinalav.com",
} as const;

export function hubTagline(author: string = BRAND.authorName) {
  return `${BRAND.hubName} · ${author}`;
}
