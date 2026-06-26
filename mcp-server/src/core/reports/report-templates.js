/**
 * Report template definitions — sections and data sources.
 */

export const REPORT_TYPES = [
  "daily_engineering",
  "weekly_health",
  "release_readiness",
  "cost",
  "risk",
  "incident_summary",
  "agent_productivity",
];

export const REPORT_TEMPLATES = {
  daily_engineering: {
    id: "daily_engineering",
    title: "Daily Engineering Brief",
    sections: ["summary", "runs", "approvals", "risks", "cost_snapshot"],
    scheduleCron: "0 8 * * *",
  },
  weekly_health: {
    id: "weekly_health",
    title: "Weekly Project Health",
    sections: ["summary", "runs", "cost", "risks", "hygiene"],
    scheduleCron: "0 9 * * 1",
  },
  release_readiness: {
    id: "release_readiness",
    title: "Release Readiness",
    sections: ["release_analysis", "migration_risks", "test_checklist"],
  },
  cost: {
    id: "cost",
    title: "Cost Report",
    sections: ["cost_7d", "cost_30d", "quota", "anomalies"],
  },
  risk: {
    id: "risk",
    title: "Risk Report",
    sections: ["failed_runs", "pending_approvals", "sla_violations"],
  },
  incident_summary: {
    id: "incident_summary",
    title: "Incident Summary",
    sections: ["timeline", "suspected_causes", "actions"],
  },
  agent_productivity: {
    id: "agent_productivity",
    title: "Agent Productivity",
    sections: ["runs", "runbooks", "schedules", "success_rate"],
  },
};
