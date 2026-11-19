import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": "http://127.0.0.1:3000" } },
  build: { outDir: "dist" },
  test: {
    projects: [
      { extends: true, test: { name: "node", environment: "node", include: ["tests/**/*.test.ts"] } },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["tests/**/*.test.tsx"],
          setupFiles: ["tests/setup-dom.ts"],
        },
      },
    ],
  },
});
