import { config } from "./core/config.js";
import { createServer } from "./core/server.js";
import { validateStartup } from "./core/sanity.js";

// Run startup sanity checks
await validateStartup();

process.on("uncaughtException", (err) => {
  console.error("[FATAL] uncaughtException:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] unhandledRejection:", reason);
  if (process.env.NODE_ENV === "production") {
    process.exit(1);
  }
});

const app = await createServer();

const bindHost =
  process.env.HUB_BIND_HOST?.trim() ||
  (process.env.NODE_ENV === "production" ? "127.0.0.1" : "0.0.0.0");

app.listen(config.port, bindHost, () => {
  console.log(`mcp-server listening on http://${bindHost === "0.0.0.0" ? "localhost" : bindHost}:${config.port}`);
});
