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
      // ----------------------------------------------------------------------
      // ENFORCE "ONE WAY" EFFECT ARCHITECTURE VIA AST SELECTOR BANS
      // ----------------------------------------------------------------------
      "no-restricted-syntax": [
        "error",

        // 1. BAN RAW THROW STATEMENTS
        // Rule: Never use 'throw new Error()'. Use yield* Effect.fail(...) or Effect.tryPromise.
        {
          selector: "ThrowStatement",
          message:
            "🚫 BANNED: Do not use raw 'throw'. Use 'yield* Effect.fail(new MyTaggedError())' or 'Effect.tryPromise'.",
        },

        // 2. BAN LEGACY POINT-FREE PIPING (.flatMap)
        // Rule: Do not chain logic via .flatMap(). Use Effect.gen(function* () { ... }) for control flow.
        {
          selector: "CallExpression[callee.property.name='flatMap']",
          message:
            "🚫 BANNED: Do not use '.flatMap()'. Use 'Effect.gen(function* () { yield* ... })' for control flow.",
        },

        // 3. BAN LEGACY CONTEXT TAGS
        // Rule: Stop using Context.Tag() / Context.GenericTag(). Use 'class MyService extends Effect.Service<MyService>()(...)'.
        {
          selector:
            "CallExpression[callee.object.name='Context'][callee.property.name=/^(Tag|GenericTag)$/]",
          message:
            "🚫 BANNED: Do not use 'Context.Tag()'. Define services using 'class MyService extends Effect.Service<MyService>()(...)'.",
        },

        // 4. BAN RAW JAVASCRIPT ERRORS IN EFFECT.FAIL
        // Rule: Do not pass raw 'new Error()' to Effect.fail. Use a Schema.TaggedError or custom Tagged Error.
        {
          selector:
            "CallExpression[callee.object.name='Effect'][callee.property.name='fail'] > NewExpression[callee.name='Error']",
          message:
            "🚫 BANNED: Do not pass raw 'new Error()' to Effect.fail. Use a 'Schema.TaggedError'.",
        },
      ],
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