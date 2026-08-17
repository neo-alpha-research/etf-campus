import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 15_000,
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**", "**/out/**", "**/.worktrees/**", "**/.codex-worktrees/**"],
  },
});
