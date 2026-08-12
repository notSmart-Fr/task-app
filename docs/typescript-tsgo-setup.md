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
// scripts:
"prepare": "effect-tsgo patch --typescript --no-oxlint"
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

## Gotchas

- After `package.json` changes, `bun install` re-runs `prepare` (`effect-tsgo patch`). The stderr note "typescript skipped..." is normal (PowerShell may show an exit-1 wrapper — ignore it).
- Don't run `TypeScriptTeam.native-preview` AND another tsgo provider in parallel — Effect docs say use `effect-tsgo` as your **sole** language server.
- `.bin/tsc` resolves through `node_modules/typescript` (which is patched to native), so `npx tsc` stays TS7 even though the `typescript` package itself is TS6.
- `effect-tsgo patch --oxlint` is optional (Oxlint is a separate fast linter for CI; not needed for editor codegen). Keep `--no-oxlint`.
