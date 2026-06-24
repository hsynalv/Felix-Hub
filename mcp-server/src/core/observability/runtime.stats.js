/**
 * Runtime Stats
 *
 * Process and runtime statistics for observability.
 */

import { getPlugins, getFailedPlugins } from "../plugins.js";
import { listTools } from "../tool-registry.js";
import { getJobStats as getLegacyJobStats } from "../jobs.js";

/**
 * Process stats
 * @returns {Object}
 */
export function getProcessStats() {
  return {
    pid: process.pid,
    ppid: process.ppid,
    title: process.title,
    version: process.version,
    versions: process.versions,
    platform: process.platform,
    arch: process.arch,
    execPath: process.execPath,
    cwd: process.cwd(),
    uptime: process.uptime(),
  };
}

/**
 * Memory usage stats
 * @returns {Object}
 */
export function getMemoryStats() {
  const mem = process.memoryUsage();

  return {
    rss: formatBytes(mem.rss),
    rssBytes: mem.rss,
    heapTotal: formatBytes(mem.heapTotal),
    heapTotalBytes: mem.heapTotal,
    heapUsed: formatBytes(mem.heapUsed),
    heapUsedBytes: mem.heapUsed,
    external: formatBytes(mem.external),
    externalBytes: mem.external || 0,
    arrayBuffers: formatBytes(mem.arrayBuffers),
    arrayBuffersBytes: mem.arrayBuffers || 0,
  };
}

/**
 * CPU usage (if available)
 * @returns {Object | null}
 */
export function getCPUStats() {
  if (process.cpuUsage) {
    const usage = process.cpuUsage();
    return {
      user: usage.user,
      system: usage.system,
    };
  }
  return null;
}

/**
 * Event loop stats (if available)
 * @returns {Object | null}
 */
export function getEventLoopStats() {
  // Node.js 18.10+ has performance.eventLoopUtilization
  // eslint-disable-next-line no-undef
  if (typeof performance !== "undefined" && performance.eventLoopUtilization) {
    try {
      const elu = performance.eventLoopUtilization();
      return {
        utilization: elu.utilization,
        idle: elu.idle,
        active: elu.active,
      };
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Resource limits
 * @returns {Object}
 */
export function getResourceLimits() {
  return {
    maxOldGenerationSize: process.memoryUsage().heapTotal,
  };
}

/**
 * Format bytes to human readable
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Get runtime stats snapshot
 * @returns {Object}
 */
export function getRuntimeStats() {
  return {
    timestamp: new Date().toISOString(),
    startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
    uptime: process.uptime(),
    uptimeFormatted: formatUptime(process.uptime()),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    memory: getMemoryStats(),
    cpu: getCPUStats(),
    eventLoop: getEventLoopStats(),
  };
}

/**
 * Format uptime to human readable
 * @param {number} seconds
 * @returns {string}
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

/**
 * Get plugin stats
 * @returns {Object}
 */
export function getPluginStats() {
  const plugins = getPlugins();
  const failed = getFailedPlugins();

  return {
    total: plugins.length + failed.length,
    enabled: plugins.length,
    loaded: plugins.length,
    healthy: plugins.length,
    failed: failed.length,
    pluginNames: plugins.map((p) => p.name),
  };
}

/**
 * Get job stats
 * @returns {Promise<Object>}
 */
export async function getJobStats() {
  return getLegacyJobStats();
}

/**
 * Get tool stats
 * @returns {Object}
 */
export function getToolStats() {
  const tools = listTools();
  const byPlugin = {};
  const categories = new Set();

  for (const tool of tools) {
    const plugin = tool.plugin || "unknown";
    byPlugin[plugin] = (byPlugin[plugin] || 0) + 1;
    for (const tag of tool.tags || []) {
      categories.add(tag);
    }
  }

  return {
    total: tools.length,
    byPlugin,
    categories: [...categories],
  };
}

/**
 * Get complete system snapshot
 * @returns {Promise<Object>}
 */
export async function getSystemSnapshot() {
  return {
    timestamp: new Date().toISOString(),
    runtime: getRuntimeStats(),
    plugins: getPluginStats(),
    jobs: await getJobStats(),
    tools: getToolStats(),
  };
}

/**
 * Health check status
 * @returns {Object}
 */
export function getHealthStatus() {
  const plugins = getPlugins();
  const failed = getFailedPlugins();
  const total = plugins.length + failed.length;

  let status_code = "healthy";
  const checks = {
    runtime: true,
    plugins: failed.length === 0,
    registry: total > 0,
  };

  if (failed.length > 0) {
    status_code = "degraded";
  }

  if (total === 0) {
    status_code = "unhealthy";
  }

  return {
    status: status_code,
    checks,
    timestamp: new Date().toISOString(),
  };
}
