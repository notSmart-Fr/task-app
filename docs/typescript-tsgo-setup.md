# TypeScript 7 (native) + Effect tsgo LSP — setup notes

Goal: native TS7 editor LSP (Effect codegen) while keeping `eslint` working.

Last verified: 2026-08-12

---

## Working config

### `package.json` (devDependencies)

```jsonc
"typescript": "npm:typescript@^6.0.0",        // real TS6 JS API for typescript-eslint / next build
"@typescript/native": "npm:typescript@^7.0.2", // native TS7 for editor LSP + tsc bin
"@effect/tsgo": "0.36.4",
"oxlint": "1.77.0",                          // must match the version @effect/tsgo supports (see below)
"oxlint-tsgolint": "7.0.2001",
// scripts:
"prepare": "effect-tsgo patch --typescript --oxlint"   // patches both TypeScript and oxlint
```

### `.vscode/settings.json`

```jsonc
"js/ts.experimental.useTsgo": true,
"js/ts.tsdk.path": "node_modules/@typescript/native",
"js/ts.tsdk.additionalLocations": ["./node_modules/@typescript/native"],
"js/ts.tsdk.promptToUseWorkspaceVersion": true
```

### `tsconfig.json` — `compilerOptions.plugins`

```jsonc
{ "name": "next", "enableTsPlugin": true },
{ "name": "@effect/language-service" }   // NOT "@effect/tsgo" (old name)
```

### Editor

Requires the **`TypeScriptTeam.native-preview`** extension installed (it's the TS7 language server host). Without it, `useTsgo` is inert and the picker only shows VS Code's bundled 6.0.3.

---

## Challenges + fixes

1. **TS 7.0.2 native ships NO `tsserver.js`** → editor language service falls back to VS Code's bundled 6.0.3. The native LSP is a *separate* provider, not part of the `typescript` npm package.

2. **`js/ts.experimental.useTsgo: true` is inert without the `TypeScriptTeam.native-preview` extension.** Fix: install that extension → reload window → `TypeScript: Select TypeScript Version` → pick the workspace version.

3. **Old plugin name `@effect/tsgo` is invalid** — the current plugin is `@effect/language-service` (matches Effect repo's own `tsconfig.base.json`).

4. **`effect-tsgo patch` is a no-op for `typescript@7`** ("typescript skipped because its hash matches the replacement") because the typescript@7 native binary == the tsgo binary (identical SHA). Expected. Effect LSP features activate via the tsconfig plugin.

5. **typescript-eslint errors "does not support TS 7.0"** → run TS6 + TS7 side-by-side via npm aliases (see config). Microsoft's recommended `@typescript/typescript6` shim is **broken under bun**: its internal `@typescript/old: npm:typescript@^6` alias installs the shim onto itself → `require('typescript')` returns an empty object. **Workaround: alias `typescript` straight to `npm:typescript@^6` and skip the shim.**

6. **`@effect/eslint-plugin@0.3.2` only ships rules:** `dprint`, `no-import-from-barrel-package`. The `@effect/durable-deferred` rule does **not** exist — remove it from `eslint.config.mjs` if present.

7. **Vendored `repos/**` must be ignored in `eslint.config.mjs`** (`globalIgnores`) or lint flags 8000+ errors from the cloned Effect repo.

---

## Verify commands (run from project root)

```powershell
npx tsc --version                    # expect: 7.0.2+effect-tsgo.0.36.4 (native tsc via patch)
node -e "console.log(require('typescript').version)"   # expect: 6.x (API for eslint)
bunx effect-tsgo get-exe-path        # expect: Effect native binary path
bun run lint                         # expect: exit 0
```

Editor: reload window → open a `.ts` file → status bar should show native tsgo; 💡 offers Effect refactors (e.g. "Wrap in Effect.gen").

---

## Oxlint + Effect tsgo (type-aware Effect linting)

Optional but recommended: `oxlint` (Rust, fast) patched by `@effect/tsgo` so it runs the **type-aware** `effecttsgo` rules — e.g. it flags `Effect.flatMap` → `Effect.succeed` when `Effect.map` suffices, `console.error` instead of `Effect.logError`, v3 APIs used in a v4 project, and `any`/`unknown` in the error channel.

Last verified: 2026-08-13

### Working config

`package.json` devDependencies — versions **must match** `@effect/tsgo`:

```jsonc
"@effect/tsgo": "0.36.4",           // latest
"oxlint": "1.77.0",                 // the version @effect/tsgo 0.36.4 ships the patched binary for
"oxlint-tsgolint": "7.0.2001",      // matching TypeScript-Go integration
// scripts:
"prepare": "effect-tsgo patch --typescript --oxlint",   // patch BOTH TS and oxlint
"lint:oxlint": "oxlint . --config ./oxlint.json"
```

`oxlint.json` (schema + preset shipped with `@effect/tsgo`):

```jsonc
{
  "$schema": "./node_modules/@effect/tsgo/oxlint-schema.json",
  "extends": ["./node_modules/@effect/tsgo/oxlint-presets/recommended.json"],
  "ignorePatterns": ["repos/**", ".next/**", "out/**", "build/**", "node_modules/**"]
}
```

`tsconfig.json` — set `diagnostics: false` on the `@effect/language-service` plugin so Effect
diagnostics are reported **only** by oxlint (avoids double-reporting in the editor):

```jsonc
{ "name": "@effect/language-service", "diagnostics": false, "allowedDuplicatedPackages": ["effect", "@effect/platform-bun", "@effect/platform-node-shared", "@effect/sql-libsql"] }
```

### Version matching (critical)

`@effect/tsgo` ships the patched `oxlint` binary for **one** specific `oxlint` version. Do **not**
run `bun add oxlint` (or `bun add @effect/tsgo`) without a version — it pulls the latest `oxlint`
(e.g. 1.78.0) which the installed tsgo cannot patch, and `prepare` fails with:

```
ReplacementUnavailableError: Missing packaged artifact .../artifacts/oxlint/1.78.0/oxlint.win32-x64-msvc.node
```

Fix: reinstall so the lockfile matches the pinned `oxlint` version (`bun install`). To upgrade, upgrade
`@effect/tsgo` first and let it dictate the matching `oxlint` / `oxlint-tsgolint` versions.

### Oxlint vs ESLint — keep both, they are not equivalent

| | ESLint | oxlint |
| --- | --- | --- |
| speed | slow | fast (Rust, parallelized) |
| custom rules | full `no-restricted-syntax` AST selectors + JS plugins | fixed built-in rule set only |
| type-aware | heavy (`@typescript-eslint`) | native (`effecttsgo`) |

- **ESLint** enforces the app's custom architecture bans oxlint cannot express (in `eslint.config.mjs`
  via `no-restricted-syntax`): raw `throw`, **all** `.flatMap()`, `Context.Tag()` / `GenericTag()`,
  `Effect.fail(new Error(...))`.
- **oxlint** enforces type-aware `effecttsgo` rules ESLint doesn't have: `flat-map-to-map`,
  `global-console`, `outdated-api`, `any-unknown-in-error-context`, …

### v4 API renames caught by oxlint

- `Effect.catchAll` was **removed** in v4 — use `Effect.tapError` to observe+log while keeping the
  failure, or `Effect.catchCause` to recover. (`Effect.catch` doesn't exist in `4.0.0-beta.107` either.)
- `console.error(...)` → `Effect.logError(...)`.

### Verify

```powershell
bunx oxlint --version       # expect 1.77.0
bun run lint:oxlint         # expect exit 0
```

Known limitation: `effecttsgo` rules require oxlint's **type-aware mode**, which the tsgo patch +
`recommended` preset enable. (This project runs `effect-tsgo patch --typescript --oxlint`, so
TypeScript is patched too — the doc's `--no-typescript --oxlint` variant is available if you only
want oxlint.)

---

## Gotchas

- After `package.json` changes, `bun install` re-runs `prepare` (`effect-tsgo patch`). The stderr note "typescript skipped..." is normal (PowerShell may show an exit-1 wrapper — ignore it).
- Don't run `TypeScriptTeam.native-preview` AND another tsgo provider in parallel — Effect docs say use `effect-tsgo` as your **sole** language server.
- `.bin/tsc` resolves through `node_modules/typescript` (which is patched to native), so `npx tsc` stays TS7 even though the `typescript` package itself is TS6.
- `effect-tsgo patch --oxlint` is optional for editor codegen but **enabled in this repo** for CI/fast
  linting — see "Oxlint + Effect tsgo" above. oxlint's version must match `@effect/tsgo`; don't run
  `bun add oxlint` bare.
