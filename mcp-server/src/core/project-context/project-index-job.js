/**
 * Background job: project workspace index sync.
 */

import { registerJobRunner } from "../jobs.js";
import { syncProjectIndex } from "../project-context/project-indexer.js";

export const PROJECT_INDEX_JOB_TYPE = "project_index";

export function registerProjectIndexJobRunner() {
  registerJobRunner(PROJECT_INDEX_JOB_TYPE, async (job, updateProgress, log) => {
    const { projectId, sinceDays = 14 } = job.payload || {};
    if (!projectId) throw new Error("projectId required");

    log(`Syncing project index: ${projectId}`);
    updateProgress(10);

    const result = await syncProjectIndex(projectId, { sinceDays });
    if (!result.ok) throw new Error(result.error?.message || "sync failed");

    updateProgress(100);
    log(`Synced ${result.synced} events`);
    return result;
  });
}
