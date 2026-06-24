/**
 * Jobs Metrics
 *
 * Metrics collection for jobs/queue system.
 * Uses canonical jobs.js (not deprecated jobs/job.manager.js).
 */

import { getJobStats } from "../jobs.js";
import { Metrics, getMetricsRegistry } from "./metrics.js";

/**
 * Record job event
 * @param {string} jobType
 * @param {string} status - "queued" | "started" | "completed" | "failed" | "cancelled"
 * @param {string} [plugin]
 */
export function recordJobEvent(jobType, status, plugin) {
  const registry = getMetricsRegistry();

  registry.increment(Metrics.JOB_EVENTS_TOTAL, 1, {
    jobType,
    status,
    plugin: plugin || "unknown",
  });

  if (status === "completed") {
    registry.increment("job_completed_total", 1, { jobType });
  } else if (status === "failed") {
    registry.increment("job_failed_total", 1, { jobType });
  } else if (status === "cancelled") {
    registry.increment("job_cancelled_total", 1, { jobType });
  }
}

/**
 * Record job duration
 * @param {string} jobType
 * @param {number} durationMs
 * @param {string} [plugin]
 */
export function recordJobDuration(jobType, durationMs, plugin) {
  const registry = getMetricsRegistry();

  registry.observe(Metrics.JOB_DURATION_MS, durationMs, {
    jobType,
    plugin: plugin || "unknown",
  });
}

/**
 * Update job gauges
 * @param {number} running
 * @param {number} queued
 */
export function updateJobGauges(running, queued) {
  const registry = getMetricsRegistry();

  registry.set(Metrics.JOBS_RUNNING, running);
  registry.set(Metrics.JOBS_QUEUED, queued);
}

/**
 * Get job metrics snapshot
 * @returns {Promise<Object>}
 */
export async function getJobMetrics() {
  const counts = await getJobStats();

  return {
    jobs_running: counts.running ?? 0,
    jobs_queued: counts.queued ?? 0,
    jobs_completed: counts.completed ?? 0,
    jobs_failed: counts.failed ?? 0,
    jobs_cancelled: counts.cancelled ?? 0,
    jobs_total: counts.total ?? 0,
  };
}

/**
 * Sync job metrics with canonical job store
 */
export async function syncJobMetrics() {
  const counts = await getJobStats();
  updateJobGauges(counts.running ?? 0, counts.queued ?? 0);
}

/**
 * Initialize job metrics
 */
export function initializeJobMetrics() {
  const registry = getMetricsRegistry();
  registry.set(Metrics.JOBS_RUNNING, 0);
  registry.set(Metrics.JOBS_QUEUED, 0);
}
