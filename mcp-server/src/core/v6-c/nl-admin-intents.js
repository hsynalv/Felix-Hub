/**
 * Natural language admin intent catalog (V6.10).
 */

export const NL_ADMIN_INTENTS = [
  {
    id: "plugin_enable",
    label: "Plugin etkinleştir",
    patterns: [
      /(?:github|notion|slack|n8n)\s+plugin['']?(?:\s+için)?\s+(?:aç|enable|etkinleştir)/i,
      /(aç|enable)\s+(?:the\s+)?(github|notion|slack|n8n)\s+plugin/i,
    ],
    extract: (text) => {
      const m = text.match(/(github|notion|slack|n8n)/i);
      return { plugin: m ? m[1].toLowerCase() : null };
    },
  },
  {
    id: "shell_write_disable_prod",
    label: "Production shell write kapat",
    patterns: [/production['']?(?:da)?\s+shell\s+write\s+kapat/i, /disable\s+shell\s+write\s+in\s+production/i],
    extract: () => ({ env: "production", tool: "shell_execute" }),
  },
  {
    id: "set_monthly_cost_limit",
    label: "Aylık maliyet limiti",
    patterns: [
      /aylık\s+\$?(\d+(?:\.\d+)?)\s+limit/i,
      /(?:agent['']?a|bu agent['']?a)\s+aylık\s+\$?(\d+)/i,
      /monthly\s+\$?(\d+)\s+limit/i,
    ],
    extract: (text) => {
      const m = text.match(/\$?(\d+(?:\.\d+)?)/);
      return { limitUsd: m ? Number(m[1]) : null };
    },
  },
  {
    id: "set_autonomy_level",
    label: "Autonomy seviyesi",
    patterns: [
      /(L[0-5])\s+(?:seviye|level|autonomy)/i,
      /autonomy\s+(L[0-5])/i,
      /(development|production)\s+(?:için\s+)?(L[0-5])/i,
    ],
    extract: (text) => {
      const levelM = text.match(/L[0-5]/i);
      const envM = text.match(/(development|production)/i);
      return {
        level: levelM ? levelM[0].toUpperCase() : null,
        env: envM ? envM[1].toLowerCase() : null,
      };
    },
  },
  {
    id: "desktop_app_allowlist",
    label: "Desktop uygulama kısıtı",
    patterns: [
      /desktop\s+control\s+sadece\s+(.+)\s+(?:ve|and)\s+(.+)\s+(?:da\s+)?çalışsın/i,
      /desktop\s+(?:only|sadece)\s+(.+)/i,
    ],
    extract: (text) => {
      const m = text.match(/sadece\s+(.+?)(?:\s+ve\s+|\s+and\s+)(.+?)(?:\s+da|\s*$)/i);
      if (m) return { apps: [m[1].trim(), m[2].trim()] };
      const single = text.match(/desktop\s+(?:only|sadece)\s+(.+)/i);
      return { apps: single ? [single[1].trim()] : [] };
    },
  },
];

export function listNLAdminIntents() {
  return NL_ADMIN_INTENTS.map(({ id, label }) => ({ id, label }));
}

export function matchNLAdminIntent(text) {
  if (!text || typeof text !== "string") return null;
  const normalized = text.trim();
  for (const intent of NL_ADMIN_INTENTS) {
    for (const pattern of intent.patterns) {
      if (pattern.test(normalized)) {
        return {
          intentId: intent.id,
          label: intent.label,
          params: intent.extract(normalized),
          matchedPattern: pattern.source,
        };
      }
    }
  }
  return null;
}
