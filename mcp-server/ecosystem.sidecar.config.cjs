/**
 * PM2 — Felix Desktop (sidecar) on your Mac/PC
 *
 * Env: ~/.config/felix-desktop/env (loaded automatically by sidecar-daemon.js)
 * Does not start felix-hub — use ecosystem.config.cjs for the server.
 */

const path = require("path");

module.exports = {
  apps: [
    {
      name: "felix-sidecar",
      cwd: __dirname,
      script: "bin/sidecar-daemon.js",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      min_uptime: "5s",
      max_restarts: 20,
      restart_delay: 2000,
      error_file: path.join(__dirname, "logs/sidecar-pm2-error.log"),
      out_file: path.join(__dirname, "logs/sidecar-pm2-out.log"),
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
      kill_timeout: 5000,
    },
  ],
};
