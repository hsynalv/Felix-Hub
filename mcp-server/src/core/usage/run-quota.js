import { checkQuota } from "./quota.service.js";

/** Enforce project quota before starting an agent/workflow run. */
export async function assertRunQuota(projectId) {
  const pid = projectId || "default";
  const result = await checkQuota({ projectId: pid });
  if (!result.allowed) {
    const err = new Error(result.reason || "Project quota exceeded");
    err.code = "quota_exceeded";
    err.quota = result.quota;
    throw err;
  }
  return result;
}
