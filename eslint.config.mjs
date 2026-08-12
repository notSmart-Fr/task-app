import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import effectPlugin from "@effect/eslint-plugin";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      "@effect": effectPlugin,
    },
    rules: {
      // Add specific Effect rules here if desired
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored repo (mirrored in .vscode/settings.json excludes):
    "repos/**",
  ]),
]);

export default eslintConfig;
