/**
 * PM2 — Felix Hub daemon
 *
 * Loads .env so PM2 does not override NODE_ENV (avoids production sanity failures on local).
 * Production: set NODE_ENV=production + CORS_ALLOWED_ORIGINS in .env, then pm2 start --update-env
 */

const path = require("path");

require("dotenv").config({ path: path.join(__dirname, ".env") });

module.exports = {
  apps: [
    {
      name: "felix-hub",
      cwd: __dirname,
      script: "src/index.js",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      min_uptime: "10s",
      max_restarts: 15,
      restart_delay: 3000,
      env: {
        NODE_ENV: process.env.NODE_ENV || "development",
      },
      error_file: path.join(__dirname, "logs/pm2-error.log"),
      out_file: path.join(__dirname, "logs/pm2-out.log"),
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
      kill_timeout: 8000,
      listen_timeout: 15000,
    },
  ],
};
