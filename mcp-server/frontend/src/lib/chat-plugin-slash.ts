/** Parse `/plugin message` prefix from user input */
export function parsePluginSlashMessage(
  text: string,
  pluginNames: string[],
  activePlugin: string | null
): { message: string; pluginFilter: string | null } {
  const trimmed = text.trim();
  if (!trimmed) return { message: "", pluginFilter: activePlugin };

  const match = trimmed.match(/^\/([a-zA-Z0-9_-]+)(?:\s+([\s\S]*))?$/);
  if (match) {
    const name = match[1].toLowerCase();
    if (pluginNames.includes(name)) {
      const body = (match[2] ?? "").trim();
      return { message: body, pluginFilter: name };
    }
  }

  return { message: trimmed, pluginFilter: activePlugin };
}

/** True when input is an in-progress `/` plugin command (no space yet) */
export function getSlashPaletteState(input: string): { open: boolean; query: string } | null {
  const match = input.match(/^\/([a-zA-Z0-9_-]*)$/);
  if (!match) return null;
  return { open: true, query: match[1].toLowerCase() };
}

export function filterPlugins(
  plugins: Array<{ name: string; description?: string; tools?: unknown[] }>,
  query: string
) {
  const q = query.trim().toLowerCase();
  if (!q) return plugins;
  return plugins.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      (p.description || "").toLowerCase().includes(q)
  );
}
