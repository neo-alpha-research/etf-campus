import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "coverage/**",
    ".worktrees/**",
    "next-env.d.ts",
    "add_borders.js",
    "add_precise_borders.js",
    "compact_table.js",
    "update_tooltips.js",
    "scratch/**",
    "workers/**/.wrangler/**",
  ]),
]);
