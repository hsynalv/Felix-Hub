/**
 * Jobs System Index
 *
 * Canonical runtime: ../jobs.js (submitJob, getJob, listJobs, getJobStats).
 * @deprecated job.manager.js and related classes — not wired at server startup.
 */

export {
  createJob,
  submitJob,
  getJob,
  listJobs,
  cancelJob,
  getJobLogs,
  getJobStats,
  JobState,
  registerJobRunner,
  registerJobRunner as registerJobHandler,
  resetJobsForTests,
} from "../jobs.js";

// Deprecated — tests and migration only
export { JobStatus, VALID_JOB_STATUSES } from "./job.types.js";
export { JobManager, createJobManager, getJobManager, setJobManager } from "./job.manager.js";
