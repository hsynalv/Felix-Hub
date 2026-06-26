/**
 * Product branding — user-facing names (technical package/repo ids may stay legacy).
 */

export const BRAND = {
  /** Platform name */
  hubName: "Felix Hub",
  /** Chat / Telegram assistant persona */
  assistantName: "Felix",
  /** Local desktop agent (sidecar daemon) */
  desktopAgentName: "Felix Desktop",
  /** MCP STDIO / CLI product label */
  cliName: "Felix CLI",
  authorName: "Hüseyin Alav",
  productionUrl: "https://asistan.huseyinalav.com",
};

export function hubTagline(author = BRAND.authorName) {
  return `${BRAND.hubName} · ${author}`;
}
