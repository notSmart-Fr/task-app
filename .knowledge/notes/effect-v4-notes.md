# Effect v4 migration notes (task-app)

Target = vendored `repos/effect` (`4.0.0-beta.107`). App migrated from effect 3.22 +
`@effect/platform` 0.97 + drizzle to effect v4 + `@effect/sql-libsql` (drizzle removed, pnpm + node used).

## Key version facts

- v4: HttpApi/Http/Sql live in `effect/unstable/*` (httpapi, http, sql). `@effect/platform` package
  NO LONGER exists in v4 — use `@effect/platform-bun` / `@effect/platform-node`.
- `@effect/sql-libsql@4.0.0-beta.x` requires `@libsql/client@^0.17.4` (same as drizzle had). Pin
  exact `4.0.0-beta.107` to stay aligned with the vendored repo.
- Endpoints use object-form options `{ params, query, payload, success, error }`;
  `HttpApiEndpoint.delete` (not `del`).

## Hard-won gotchas (all reproduced at runtime)

1. `Layer.provideMerge(LibsqlClient.layer, LibsqlMigrator.layer)` does NOT thread SqlClient into the
   migrator in beta.107 ("Service not found: effect/sql/SqlClient"). Use:
   `Layer.mergeAll(clientLayer, migrator).pipe(Layer.provideMerge(clientLayer))`.
2. `HttpRouter.toWebHandler` request-context: services referenced in handler BODIES (e.g.
   `Effect.andThen(TasksRepo, ...)`) leak into the per-request context => the handler needs a
   required 2nd `context` arg (breaks Next route typing). FIX: capture the service in the group
   builder closure (`Effect.fn(function*(handlers) { const repo = yield* TasksRepo; ... })`) and
   `Layer.provide(TasksRepoLive)` on the group layer. Also use `Layer.provideMerge` (not `provide`)
   for handler/db layers in `route.ts` so services are in the layer's provides (excluded from the
   request context).
3. `Schema.Class` response encoding validates against class INSTANCES — returning a plain object
   fails with `SchemaError: Expected Task` (400). Always `new Task({ ... })`.
4. HttpApi handlers may only fail with errors the endpoint DECLARES — leaking `SqlError` is a type
   error. Convert infra errors with `Effect.orDie` at the service boundary; keep only domain
   `Schema.TaggedError`s.
5. Next `route.ts`: wrap the Effect handler as `(request) => handler(request)` — Next passes
   `{ params }` as the 2nd arg, Effect's optional `Context` 2nd arg clashes with `RouteHandlerConfig`
   typing.
6. `next build` must run from the project dir; via a `cmd /c` subshell Turbopack static-gen
   intermittently fails with `Expected workStore to be initialized` on default pages (unrelated to
   code). Run `pnpm build` (next build) directly from the project root.
7. ESLint in this repo bans `.flatMap()` and `Context.Tag()`/`GenericTag()` — use
   `Effect.gen`/`Effect.map`/`Effect.andThen` and `Context.Service`.
8. Vendored `repos/effect` must be excluded from the app tsconfig
   (`"exclude": ["node_modules", "repos"]`) or `next build` type-checks it (its own deps aren't
   installed).
9. Package manager is pnpm (bun dropped due to Windows bugs). Standalone TS scripts run via `tsx`
   (`pnpm db:migrate`). For authoritative type checks use
   `node node_modules/typescript/bin/tsc --noEmit`; `next build` is the final arbiter.

## Oxlint + tsgo setup (task-app)

- Version matching is REQUIRED: `@effect/tsgo@0.36.4` (latest) ships the patched oxlint binary ONLY
  for `oxlint@1.77.0`. Do NOT `bun add oxlint` (pulls latest 1.78.0) — the `prepare` patch then
  fails with `ReplacementUnavailableError: Missing packaged artifact .../artifacts/oxlint/1.78.0/...`.
  `oxlint-tsgolint@7.0.2001` is the match.
- Config: `oxlint.json` extends `@effect/tsgo/oxlint-presets/recommended.json` (schema from tsgo).
  LSP: `@effect/language-service` has `diagnostics: false` in tsconfig so Effect diagnostics come
  only from oxlint (avoids double-reporting).
- `prepare` = `effect-tsgo patch --typescript --oxlint` (TS + oxlint both patched).
- oxlint vs eslint: NOT equivalent. oxlint (Rust, fast) + effecttsgo rules are type-aware (flags
  `flatMap`→`succeed`, `global-console`, `outdated-api`, `any-unknown-in-error-context`). eslint has
  fully custom `no-restricted-syntax` bans oxlint can't express (raw throw, ALL `.flatMap`,
  `Context.Tag`, `Effect.fail(new Error)`). Keep both.

## v4 API rename gotchas (caught by oxlint effecttsgo(outdated-api))

- `Effect.catchAll` was REMOVED in v4 (oxlint says renamed to `catch`, but installed
  4.0.0-beta.107 has neither) — use `Effect.tapError` to observe+log while keeping failure, or
  `Effect.catchCause` to recover. `Effect.catch` doesn't exist in beta.107.
- `console.error` → `Effect.logError` (effecttsgo global-console).

## Structure (verified working)

- `src/lib/db/migrations.ts` (Migrator.fromRecord, inline migrations) + `client.ts` (DbLive) +
  `migrate.ts` (`pnpm db:migrate` via tsx).
- `src/api/index.ts` composes groups: `HttpApi.make("root").add(SystemGroup).add(TasksGroup)`.
- `src/features/tasks/{schema,routes,service,handlers,index}.ts` — see
  `.knowledge/agent-patterns/effect-core.md` sections 8.x.
- `src/app/api/[[...route]]/route.ts` wires `HttpApiBuilder.layer` + `HttpRouter.toWebHandler` +
  `HttpServer.layerServices`.
