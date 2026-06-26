/**
 * Engineering agent presets — runbooks + recommended schedules (Faz B).
 */

export const AGENT_SCHEDULE_PRESETS = [
  {
    id: "preset-daily-brief",
    name: "Daily engineering brief",
    reportType: "daily_engineering",
    cronExpr: "0 8 * * *",
    timezone: "UTC",
    maxCostUsd: 1,
    autonomyLevel: "L4",
    notifyTarget: "native",
    description: "Her sabah 08:00 UTC — daily engineering brief üret ve inbox'a ekle",
  },
  {
    id: "preset-weekly-maintenance",
    name: "Haftalık dependency scan",
    runbookId: "rb-maintenance",
    cronExpr: "0 9 * * 1",
    timezone: "UTC",
    maxCostUsd: 5,
    autonomyLevel: "L4",
    skipIf: { type: "cost_anomaly" },
    description: "Her pazartesi 09:00 UTC — outdated + vuln scan",
  },
  {
    id: "preset-weekly-hygiene",
    name: "Haftalık workspace hygiene",
    runbookId: "rb-hygiene",
    cronExpr: "0 9 * * 1",
    timezone: "UTC",
    maxCostUsd: 3,
    autonomyLevel: "L3",
    parameters: { stalePrDays: 30, archiveRunDays: 90 },
    description: "Her pazartesi 09:00 UTC — stale PR, TODO, failed run raporu",
  },
  {
    id: "preset-release-on-demand",
    name: "Release manager (manual)",
    runbookId: "rb-release-manager",
    cronExpr: null,
    manual: true,
    autonomyLevel: "L2",
    description: "On-demand release — changelog + semver + draft release",
  },
];

export function listAgentPresets() {
  return {
    runbookIds: ["rb-release-manager", "rb-maintenance", "rb-hygiene"],
    templateIds: ["release-manager", "dependency-maintenance", "workspace-hygiene"],
    schedules: AGENT_SCHEDULE_PRESETS,
  };
}
