import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "../src/public/app",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/auth": "http://localhost:8787",
      "/health": "http://localhost:8787",
      "/whoami": "http://localhost:8787",
      "/plugins": "http://localhost:8787",
      "/audit": "http://localhost:8787",
      "/jobs": "http://localhost:8787",
      "/approvals": "http://localhost:8787",
      "/approve": "http://localhost:8787",
      "/ui": "http://localhost:8787",
      "/brain": "http://localhost:8787",
      "/settings": "http://localhost:8787",
      "/observability": "http://localhost:8787",
      "/workspace": "http://localhost:8787",
      "/runs": "http://localhost:8787",
      "/usage": "http://localhost:8787",
      "/projects": "http://localhost:8787",
      "/marketplace": "http://localhost:8787",
      "/sidecar": "http://localhost:8787",
      "/mcp-connectors": "http://localhost:8787",
      "/tools": "http://localhost:8787",
      "/admin": "http://localhost:8787",
      "/ops": "http://localhost:8787",
      "/agents": "http://localhost:8787",
      "/reports": "http://localhost:8787",
      "/sla": "http://localhost:8787",
      "/env": "http://localhost:8787",
      "/integrations": "http://localhost:8787",
      "/multi-agent": "http://localhost:8787",
      "/skills": "http://localhost:8787",
      "/watchers": "http://localhost:8787",
      "/sandbox": "http://localhost:8787",
      "/trust": "http://localhost:8787",
      "/inbox": "http://localhost:8787",
      "/observability-pro": "http://localhost:8787",
      "/app-store": "http://localhost:8787",
      "/compliance": "http://localhost:8787",
      "/nl-admin": "http://localhost:8787",
      "/conflicts": "http://localhost:8787",
      "/personal": "http://localhost:8787",
      "/eval": "http://localhost:8787",
      "/team": "http://localhost:8787",
      "/openapi.json": "http://localhost:8787",
    },
  },
});
