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
      "/health": "http://localhost:8787",
      "/whoami": "http://localhost:8787",
      "/plugins": "http://localhost:8787",
      "/audit": "http://localhost:8787",
      "/jobs": "http://localhost:8787",
      "/approvals": "http://localhost:8787",
      "/approve": "http://localhost:8787",
      "/ui": "http://localhost:8787",
      "/brain": "http://localhost:8787",
      "/observability": "http://localhost:8787",
      "/openapi.json": "http://localhost:8787",
    },
  },
});
