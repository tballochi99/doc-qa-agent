import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The frontend talks to the backend through /api, proxied in dev and
// rewritten by the reverse proxy / VITE_API_URL in production.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL || "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
