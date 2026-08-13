# Effect v4 foundation & scaling notes

Notes on the idiomatic Effect v4 foundation in this repo and how to extend it when
features need retry, concurrency, rate-limiting, or pooling.

Last verified: 2026-08-13

See also: [`agent-patterns/effect-core.md`](../agent-patterns/effect-core.md) section 8 for the
verified end-to-end vertical slice (schema → routes → handlers → service → SQL → route).

---

## The foundation (what we have, verified working)

The app is a straightforward CRUD API, but every layer is built with idiomatic Effect v4:

| Layer | Pattern |
|---|---|
| Domain model | `Schema.Class` + `Schema.TaggedError` (with `httpApiStatus`) |
| Control flow | `Effect.gen` + `yield*`, `Effect.fn`, no `throw` / `try/catch` / `.flatMap` |
| DI | `Context.Service` + `Layer`; services resolved in the `HttpApiBuilder.group` closure |
| Persistence | generic `SqlClient` tag + tagged-template SQL; `DbLive` (libsql + migrations) |
| HTTP | `HttpApiGroup`/`HttpApiEndpoint` (object-form), `HttpApiBuilder.group` handlers |
| Errors | declared domain errors → HTTP status; infra failures → 500; global `catchCause` → JSON + logs |
| Layout | `src/features/<feature>/` vertical slice composed into `src/api/index.ts`, wired in `route.ts` |

Adding a feature = a new `src/features/<feature>/` folder + one line in `src/api/index.ts`.

## Deliberate simplifications (revisit when complexity arrives)

These were chosen for a small app. They are the **first things to revisit**, not rewrite targets.

1. **`orDie` error boundary in the repo.**
   `SqlError` is converted to a defect at the service boundary so unexpected DB failures
   surface as 500s. This is correct for a simple API but **swallows the typed error before
   retry can act on it**. See "Retry" below for the fix.

2. **Single `SqlClient` + serialized migrations.**
   One libsql client, no pool tuning. Fine now; revisit under load (see "Pooling").

3. **In-memory / no-op platform services in `route.ts`.**
   `HttpServer.layerServices` includes a no-op `FileSystem` — fine for a web-handler API with
   `fromRecord` migrations. If you add file/asset serving, provide a real `FileSystem` layer.

## Advanced patterns & where they slot in

All of these compose onto the existing seams (service interfaces, layer wiring, error
channel) — no structural rewrite required.

### Retry (`Effect.retry` + `Schedule`)

Retry the SQL *statement*, before `orDie`:

```ts
findById: (id) =>
  Effect.gen(function*() {
    const rows = yield* sql<TaskRow>`SELECT id, title, done FROM tasks WHERE id = ${id}`.pipe(
      Effect.retry({ times: 3, schedule: Schedule.exponential("100 millis") })
    )
    // ...
  })
```

For cases where recovery matters, stop `orDie`-ing and keep `SqlError` typed in the service
interface, then retry at the handler/application layer with a `Schedule`.

### Concurrency (`Effect.all` / `Effect.forEach` / fork-join)

```ts
// parallel fan-out with limited concurrency
const results = yield* Effect.forEach(
  ids,
  (id) => repo.findById(id),
  { concurrency: 10 }
)
```

- `Effect.all([a, b], { concurrency: "unbounded" })` — run effects concurrently.
- `Effect.fork` + `Effect.join` / `Fiber` — fire-and-forget or gather independent work.
- Keep concurrency bounded to avoid saturating the DB; `LibsqlClient` has its own
  `concurrency` config too.

### Rate limiting / mutual exclusion (`Semaphore`)

```ts
const semaphore = yield* Effect.makeSemaphore(5)
// then in a service method:
const result = yield* semaphore.withPermits(1)(limitedResource)
```

Better: make the semaphore (or a `Pool`) a `Context.Service` dependency so it is provided by a
Layer and replaceable in tests.

### Pooling (`Pool` / client config)

- `LibsqlClient.layer({ url, concurrency: 20 })` raises the driver's concurrency limit.
- For heavier setups, build a `Pool` of resources in a Layer and hand it to services that need
  to acquire per request.

### Resilience conventions

- Keep **domain errors typed** (`Schema.TaggedError`) and declared on endpoints.
- Keep **infrastructure errors** (`SqlError`, HTTP failures) out of handler error channels;
  convert at the boundary (retry there first, then `orDie`).
- Add **config** (timeouts, retry counts) as a `Config`-backed service rather than constants.

## Checklist for adding a new feature

1. `src/features/<feature>/schema.ts` — `Schema.Class` entity + payloads + `TaggedError`s.
2. `src/features/<feature>/routes.ts` — `HttpApiGroup` + object-form endpoints.
3. `src/features/<feature>/service.ts` — `Context.Service` + `Layer`, queries via `SqlClient`.
4. `src/features/<feature>/handlers.ts` — `HttpApiBuilder.group`, resolve the service in the
   builder closure, `Layer.provide` the service layer.
5. Migration in `src/lib/db/migrations.ts` (`Migrator.fromRecord`).
6. Compose the group in `src/api/index.ts` (`HttpApi.make(...).add(...)`).
7. Verify: `bun run db:migrate`, `bun run lint`, `bun run lint:oxlint`, `bunx next build`.
