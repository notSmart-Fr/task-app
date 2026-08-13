# Effect core patterns for this repository

This note captures the idiomatic patterns used in the vendored Effect codebase for schema modeling, typed errors, generators, and HttpApi definitions.

> **Target version.** This file documents Effect **v4** (matching the vendored
> `repos/effect` tree, `4.0.0-beta.x`). In v4 the HTTP API lives under
> `effect/unstable/httpapi` and `effect/unstable/http`, and endpoints use the
> object-form options (`{ params, query, payload, success, error }`). The app's
> installed packages are still Effect 3.22 + `@effect/platform` 0.97, whose
> `HttpApi*` modules live in `@effect/platform` and use the builder form
> (`.addSuccess(...)`, `.addError(...)`, `.setPath(...)`, `.setPayload(...)`, plus
> `HttpApiBuilder.httpApp` / `HttpApiBuilder.Router.Live` /
> `HttpApiBuilder.Middleware.layer`). Treat the older API as the one to migrate
> away from as the app moves to v4.

## 1. Schema definition: prefer Schema.Class and Schema.TaggedError

Use Schema.Class for domain models that should be validated and typed at runtime. Use Schema.TaggedError for recoverable domain failures that belong in the Effect error channel rather than as ordinary JavaScript exceptions.

```ts
import { Effect, Schema } from "effect"

export class User extends Schema.Class<User>("User")({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String
}) {}

export class InvalidUserPayload extends Schema.TaggedError<InvalidUserPayload>()("InvalidUserPayload", {
  message: Schema.String
}) {}

export class UserNotFound extends Schema.TaggedError<UserNotFound>()("UserNotFound", {}, {
  httpApiStatus: 404
}) {}
```

### Why this is preferred

- Schema.Class gives you a validated runtime value and a TypeScript type that stays aligned with the schema.
- Schema.TaggedError makes error handling explicit, composable, and type-safe.
- These patterns are used throughout the repository docs and tests, especially in the schema and HttpApi examples.

## 2. Typed error channel usage: use Effect.fail, catchTag, and catchTags

In Effect, failures should be represented as values in the error channel. Do not throw generic exceptions for ordinary application failures.

```ts
import { Effect, Schema } from "effect"

class ValidationError extends Schema.TaggedError<ValidationError>()("ValidationError", {
  message: Schema.String
}) {}

class NetworkError extends Schema.TaggedError<NetworkError>()("NetworkError", {
  statusCode: Schema.Int
}) {}

const parseUser = (input: string): Effect.Effect<string, ValidationError> =>
  input.length > 0
    ? Effect.succeed(input)
    : Effect.fail(new ValidationError({ message: "empty input" }))

const fetchUser = (id: string): Effect.Effect<string, ValidationError | NetworkError> =>
  Effect.gen(function*() {
    if (id === "bad") {
      return yield* Effect.fail(new ValidationError({ message: "bad id" }))
    }

    return yield* Effect.succeed("ok")
  })

const recovered = fetchUser("bad").pipe(
  Effect.catchTag("ValidationError", (error) => Effect.succeed(`validation: ${error.message}`))
)

const recoveredMany = fetchUser("bad").pipe(
  Effect.catchTags({
    ValidationError: (error) => Effect.succeed(`validation: ${error.message}`),
    NetworkError: (error) => Effect.succeed(`network: ${error.statusCode}`)
  })
)
```

### Idiomatic rules

- Raise typed failures with Effect.fail(new MyError(...)).
- Use catchTag for a single tagged error.
- Use catchTags for multiple tagged errors at once.
- Keep the error channel typed; let the compiler guide the recovery logic.

## 3. Standard Effect.gen yield workflow patterns

Prefer Effect.gen for imperative-style effect workflows. The repository examples consistently use the same shape:

```ts
import { Effect, Schema } from "effect"

class FileProcessingError extends Schema.TaggedError<FileProcessingError>()("FileProcessingError", {
  message: Schema.String
}) {}

const processFile = (path: string) =>
  Effect.gen(function*() {
    yield* Effect.log(`starting ${path}`)

    const contents = yield* Effect.succeed("hello")

    if (!contents) {
      return yield* Effect.fail(new FileProcessingError({ message: "empty file" }))
    }

    return contents.toUpperCase()
  })
```

### Common conventions

- Use yield* to access the value of an Effect.
- Return early with return yield* Effect.fail(...) when a terminal error should stop the generator.
- Keep the generator readable and linear; avoid mixing imperative control flow with manual exception handling.
- Prefer Effect.fn or Effect.fnUntraced for reusable helpers when the function is meant to be called repeatedly.

## 4. HttpApi patterns: define schemas first and let HttpApi use them

When building HttpApi definitions, describe the request and response shapes with schemas and attach HTTP-specific metadata to those schemas when needed.

```ts
import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiError, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi"

class User extends Schema.Class<User>("User")({
  id: Schema.String,
  name: Schema.String
}) {}

class UserNotFound extends Schema.TaggedError<UserNotFound>()("UserNotFound", {}, {
  httpApiStatus: 404
}) {}

class SearchQueryTooShort extends Schema.TaggedError<SearchQueryTooShort>()("SearchQueryTooShort", {}, {
  httpApiStatus: 422
}) {}

export class UsersApiGroup extends HttpApiGroup.make("users")
  .add(
    HttpApiEndpoint.get("list", "/", {
      query: { search: Schema.optional(Schema.String) },
      success: Schema.Array(User)
    }),
    HttpApiEndpoint.get("getById", "/:id", {
      params: { id: Schema.String },
      success: User,
      error: UserNotFound.pipe(HttpApiSchema.status(404))
    }),
    HttpApiEndpoint.get("search", "/search", {
      query: { search: Schema.String },
      success: Schema.Array(User),
      error: [
        SearchQueryTooShort.pipe(HttpApiSchema.asNoContent({ decode: () => new SearchQueryTooShort() })),
        HttpApiError.RequestTimeoutNoContent
      ]
    })
  ) {}
```

### HttpApi conventions

- Define request and response shapes with schemas first.
- Use HttpApiSchema helpers such as status, asText, asNoContent, and asMultipart to describe transport details.
- Keep endpoint errors typed and mapped to HTTP semantics through the schema layer.
- Use tagged errors and HttpApiSchema annotations rather than ad-hoc exception mapping.

## 5. Anti-patterns to strictly avoid

These patterns are explicitly discouraged in this codebase.

### Avoid generic JavaScript errors

```ts
// ❌ Avoid
throw new Error("something went wrong")
```

Use a typed Effect error instead:

```ts
// ✅ Prefer
Effect.fail(new ValidationError({ message: "something went wrong" }))
```

### Avoid manual try/catch inside Effect.gen

```ts
// ❌ Avoid
Effect.gen(function*() {
  try {
    const value = yield* someEffect
    return value
  } catch (error) {
    // not idiomatic in Effect
  }
})
```

Use Effect's error channel instead:

```ts
// ✅ Prefer
Effect.gen(function*() {
  const value = yield* someEffect
  return value
}).pipe(
  Effect.catchTag("ValidationError", (error) => Effect.succeed("fallback"))
)
```

### Avoid mixing domain logic with ad-hoc HTTP error handling

```ts
// ❌ Avoid
function handler() {
  try {
    // do work
  } catch (error) {
    return new Response("internal error", { status: 500 })
  }
}
```

Prefer typed errors and HttpApi schema annotations:

```ts
// ✅ Prefer
Effect.gen(function*() {
  return yield* Effect.fail(new UserNotFound())
}).pipe(
  Effect.catchTag("UserNotFound", () => Effect.succeed("not found"))
)
```

### Avoid bypassing the schema layer for validation

```ts
// ❌ Avoid
const user = JSON.parse(input) as User
```

Prefer a schema-backed decoder:

```ts
// ✅ Prefer
const decoded = yield* Schema.decodeUnknownEffect(User)(input)
```

## 6. Reusable effect functions: prefer Effect.fn or Effect.fnUntraced

When a helper is going to be called repeatedly, prefer a reusable Effect function over wrapping Effect.gen in a plain function.

```ts
import { Effect, Schema } from "effect"

class ValidationError extends Schema.TaggedError<ValidationError>()("ValidationError", {
  message: Schema.String
}) {}

export const parseUser = Effect.fnUntraced(function*(input: string) {
  if (input.length === 0) {
    return yield* Effect.fail(new ValidationError({ message: "empty input" }))
  }

  return input
})
```

### Why this is preferred

- It keeps the effect boundary explicit.
- It avoids boilerplate wrappers that only return Effect.gen.
- It is more consistent with the repository’s guidance around reusable helpers and tracing.

## 7. Service and layer boundaries: prefer Context.Service and Layer

For dependencies such as repositories, clients, and configuration, use services and layers rather than globals or ad-hoc construction.

```ts
import { Context, Effect, Layer, Schema } from "effect"

class UserRepo extends Context.Service<UserRepo, {
  readonly find: (id: string) => Effect.Effect<{ id: string }, never>
}>()("UserRepo") {}

const UserRepoLive = Layer.succeed(UserRepo, {
  find: (id) => Effect.succeed({ id })
})
```

### Why this is preferred

- Dependencies become explicit and testable.
- The runtime wiring is composable and can be replaced per environment.
- It matches the way Effect code in this repository is structured around services and layers.

## 8. End-to-end vertical slice: one feature, schema to route

The sections above cover individual idioms. This section shows how they compose for a single feature (`tasks`), in the order data flows: schema → routes → service (with SQL) → handlers → root API → global route.

### 8.1 Feature schema — `src/features/tasks/schema.ts`

```ts
import { Schema } from "effect"

export class Task extends Schema.Class<Task>("Task")({
  id: Schema.Number,
  title: Schema.String,
  done: Schema.Boolean
}) {}

export class CreateTask extends Schema.Class<CreateTask>("CreateTask")({
  title: Schema.String
}) {}

export class UpdateTask extends Schema.Class<UpdateTask>("UpdateTask")({
  title: Schema.optional(Schema.String),
  done: Schema.optional(Schema.Boolean)
}) {}

export class TaskNotFound extends Schema.TaggedError<TaskNotFound>()("TaskNotFound", {
  id: Schema.Number
}, {
  httpApiStatus: 404
}) {}
```

Notes:

- `CreateTask` / `UpdateTask` are request payload schemas.
- `TaskNotFound` is a tagged domain error annotated with `httpApiStatus: 404`, so HttpApi encodes it as a 404 response.

### 8.2 Feature routes — `src/features/tasks/routes.ts`

Describe the HTTP contract with `HttpApiEndpoint` and attach the endpoints to an `HttpApiGroup`. Path parameters and payloads are schema-driven.

```ts
import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi"
import { CreateTask, Task, TaskNotFound, UpdateTask } from "./schema"

export const TasksGroup = HttpApiGroup.make("tasks")
  .add(
    HttpApiEndpoint.get("getTasks", "/", {
      success: Schema.Array(Task)
    }),
    HttpApiEndpoint.get("getTaskById", "/:id", {
      params: { id: Schema.NumberFromString },
      success: Task,
      error: TaskNotFound
    }),
    HttpApiEndpoint.post("createTask", "/", {
      payload: CreateTask,
      success: Task
    }),
    HttpApiEndpoint.put("updateTask", "/:id", {
      params: { id: Schema.NumberFromString },
      payload: UpdateTask,
      success: Task,
      error: TaskNotFound
    }),
    HttpApiEndpoint.delete("deleteTask", "/:id", {
      params: { id: Schema.NumberFromString },
      success: HttpApiSchema.NoContent,
      error: TaskNotFound
    })
  )
  .prefix("/api")
```

Notes:

- Endpoint options are the object form: `params`, `query`, `payload`, `success`, `error`.
- `DELETE` uses `HttpApiEndpoint.delete` — the `del` alias is gone in v4.
- `.prefix("/api")` only rewrites endpoints already added to the group, so call it after `.add(...)`.

### 8.3 Feature service + SQL — `src/features/tasks/service.ts`

The service depends on the generic `SqlClient` tag and runs queries with the tagged-template constructor. Statements are `Effect`s; yield them to execute.

```ts
// src/lib/db/client.ts
import { Layer } from "effect"
import { LibsqlClient, LibsqlMigrator } from "@effect/sql-libsql"
import { migrationsLoader } from "./migrations"

const clientLayer = LibsqlClient.layer({ url: "file:tasks.db" })

// Gotcha: `client.pipe(Layer.provideMerge(migrator))` does not thread SqlClient
// into the migrator in 4.0.0-beta.x ("Service not found"). Merging the two and
// then providing the client back works reliably.
export const DbLive = Layer.mergeAll(
  clientLayer,
  LibsqlMigrator.layer({ loader: migrationsLoader })
).pipe(
  Layer.provideMerge(clientLayer)
)
```

```ts
// src/features/tasks/service.ts
import { Context, Effect, Layer } from "effect"
import { SqlClient } from "effect/unstable/sql/SqlClient"
import { CreateTask, Task, TaskNotFound, UpdateTask } from "./schema"

// Raw row shape from the driver (SQLite has no native boolean -> done is 0/1).
type TaskRow = { readonly id: number; readonly title: string; readonly done: number }

// Schema.Class encoding validates against class instances, so map rows into
// real Task instances rather than plain object literals.
const toTask = (row: TaskRow): Task => new Task({ id: row.id, title: row.title, done: row.done === 1 })

// Low-level DB failures become defects (500) at the service boundary; only
// domain errors (TaskNotFound) stay in the typed error channel — which is all
// the HttpApi handler layer is allowed to fail with.
const orDie = <A, E>(effect: Effect.Effect<A, E>) => effect.pipe(Effect.orDie)

export class TasksRepo extends Context.Service<TasksRepo, {
  readonly findAll: () => Effect.Effect<ReadonlyArray<Task>>
  readonly findById: (id: number) => Effect.Effect<Task, TaskNotFound>
  readonly create: (input: CreateTask) => Effect.Effect<Task>
  readonly update: (id: number, input: UpdateTask) => Effect.Effect<Task, TaskNotFound>
  readonly remove: (id: number) => Effect.Effect<void, TaskNotFound>
}>()("TasksRepo") {}

export const TasksRepoLive = Layer.effect(
  TasksRepo,
  Effect.gen(function*() {
    const sql = yield* SqlClient

    return TasksRepo.of({
      findAll: () =>
        orDie(sql<TaskRow>`SELECT id, title, done FROM tasks ORDER BY id`).pipe(
          Effect.map((rows) => rows.map(toTask))
        ),

      findById: (id) =>
        Effect.gen(function*() {
          const rows = yield* orDie(sql<TaskRow>`SELECT id, title, done FROM tasks WHERE id = ${id}`)
          const row = rows[0]
          return row === undefined ? yield* Effect.fail(new TaskNotFound({ id })) : toTask(row)
        }),

      create: (input) =>
        orDie(
          sql<TaskRow>`INSERT INTO tasks (title, done) VALUES (${input.title}, ${input.done ? 1 : 0}) RETURNING id, title, done`
        ).pipe(Effect.map((rows) => toTask(rows[0]))),

      update: (id, input) =>
        Effect.gen(function*() {
          const rows = yield* orDie(sql<TaskRow>`
            UPDATE tasks
            SET title = COALESCE(${input.title ?? null}, title),
                done = COALESCE(${input.done == null ? null : (input.done ? 1 : 0)}, done)
            WHERE id = ${id}
            RETURNING id, title, done
          `)
          const row = rows[0]
          return row === undefined ? yield* Effect.fail(new TaskNotFound({ id })) : toTask(row)
        }),

      remove: (id) =>
        Effect.gen(function*() {
          const result = yield* orDie(sql`DELETE FROM tasks WHERE id = ${id}`.raw)
          return (result as { rowsAffected: number }).rowsAffected === 0
            ? yield* Effect.fail(new TaskNotFound({ id }))
            : yield* Effect.void
        })
    })
  })
)
```

Notes:

- `sql` is callable as a tagged template: `` sql`SELECT ... ${param}` ``. Parameters are bound, never string-interpolated. Annotate the row type with `` sql<Row>`...` ``.
- `.values` gives raw `ReadonlyArray<ReadonlyArray<unknown>>`, `.raw` the driver result (with `rowsAffected`), `.stream` a `Stream` of rows. Wrap a block in a transaction with `sql.withTransaction(effect)`.
- Keep `SqlError` out of the service interface: convert it to a defect (`Effect.orDie`) so unexpected DB failures become 500s, and only return domain errors (`TaskNotFound`) that the endpoints declare. Handlers cannot return undeclared errors (it is a type error).

### 8.4 Feature handlers — `src/features/tasks/handlers.ts`

Implement the group with `HttpApiBuilder.group`. Each handler receives the decoded `params` / `query` / `payload` / `headers` plus the raw `request`.

```ts
import { Effect, Layer } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Api } from "@/api"
import { TasksRepo, TasksRepoLive } from "./service"

export const TasksHandlersLive = HttpApiBuilder.group(
  Api,
  "tasks",
  Effect.fn(function*(handlers) {
    const repo = yield* TasksRepo
    return handlers
      .handle("getTasks", () => repo.findAll())
      .handle("getTaskById", ({ params }) => repo.findById(params.id))
      .handle("createTask", ({ payload }) => repo.create(payload))
      .handle("updateTask", ({ params, payload }) => repo.update(params.id, payload))
      .handle("deleteTask", ({ params }) => repo.remove(params.id))
  })
).pipe(
  Layer.provide(TasksRepoLive)
)
```

Notes:

- Resolve the service once in the group builder and capture it in the handler closures (`const repo = yield* TasksRepo`), then provide it with `Layer.provide(TasksRepoLive)`. Do **not** reference a service tag inside a handler body — that leaks the service into the route's per-request context, and `HttpRouter.toWebHandler` then requires a second `context` argument.
- The endpoint identifier passed to `handle` is type-checked against the group; an unhandled endpoint (or a typo) is a compile-time error.
- `params`, `query`, and `payload` are already decoded by the endpoint schemas — do not re-validate them.
- Handlers may only fail with errors the endpoint declares (for example `TaskNotFound`); everything else must be converted (for example `Effect.orDie`) or it is a type error.

### 8.5 Root API — `src/api/index.ts`

Compose feature groups into one `HttpApi`.

```ts
import { HttpApi } from "effect/unstable/httpapi"
import { TasksGroup } from "@/features/tasks/routes"

export const Api = HttpApi.make("root").add(TasksGroup)
```

### 8.6 Global route — `src/app/api/[[...route]]/route.ts`

Wire the API into a Next.js route handler. The file must be named `route.ts`; export the web handler under each HTTP verb.

```ts
import { Effect, Layer } from "effect"
import {
  HttpEffect,
  HttpRouter,
  HttpServer,
  HttpServerError,
  HttpServerResponse
} from "effect/unstable/http"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Api } from "@/api"
import { SystemHandlersLive } from "@/api/service"
import { TasksHandlersLive } from "@/features/tasks/handlers"
import { DbLive } from "@/lib/db/client"

const AppLive = HttpApiBuilder.layer(Api).pipe(
  Layer.provideMerge(SystemHandlersLive),
  Layer.provideMerge(TasksHandlersLive),
  Layer.provideMerge(DbLive)
)

// Global error handling: v4's router already maps missing routes -> 404 and
// defects -> 500 (logging the cause), but with an empty body. Catch every cause
// here to return a JSON body with a meaningful status.
const app = Effect.gen(function*() {
  const httpEffect = yield* HttpRouter.toHttpEffect(
    AppLive.pipe(Layer.provide(HttpServer.layerServices))
  )
  return yield* httpEffect.pipe(
    Effect.catchCause((cause) =>
      Effect.gen(function*() {
        const isNotFound = cause.reasons.some(
          (reason) =>
            reason._tag === "Fail" &&
            reason.error instanceof HttpServerError.HttpServerError &&
            reason.error.reason._tag === "RouteNotFound"
        )
        yield* Effect.logError("Unhandled server error", cause)
        return yield* HttpServerResponse.json(
          { error: isNotFound ? "Route not found" : "Internal Server Error" },
          { status: isNotFound ? 404 : 500 }
        )
      })
    )
  )
})

const handle = (request: Request) => HttpEffect.toWebHandler(app)(request)

export const GET = handle
export const POST = handle
export const PUT = handle
export const DELETE = handle
```

Notes:

- `HttpApiBuilder.layer(Api)` registers the API on an `HttpRouter` and requires each group's handler layer. `HttpServer.layerServices` provides the platform services the router needs (`HttpPlatform`, `Path`, `FileSystem`, weak `Etag.Generator`).
- `HttpRouter.toHttpEffect(appLayer)` exposes the router as an `Effect`; apply `Effect.catchCause` there for global error handling, then convert with `HttpEffect.toWebHandler`.
- The handler is `(request, context?) => Promise<Response>`; wrap it as `(request) => handler(request)` so the exported signature matches Next's `RouteHandlerConfig` (which passes a params object as the second argument).

### 8.7 Wiring gotchas

- Name the file `route.ts`, not `routes.ts` — Next.js ignores `routes.ts` and returns 404.
- Yield `HttpServerRequest.HttpServerRequest` directly; `Effect.service(...)` does not exist.
- Build responses with `HttpServerResponse` constructors (`text`, `json`, `uint8Array`, `empty`, `jsonUnsafe`) — there is no `.withBody(...)`.
- Do not return a hard-coded payload for every URL; the router already dispatches on the path.
- `Schema.Class` response schemas validate against class instances — return `new Task(...)`, not a plain object literal, or the response encoding fails with `SchemaError: Expected Task` (400).
- Capture services in the `HttpApiBuilder.group` builder closure and provide them with `Layer.provide`; referencing a tag inside a handler body leaks it into the per-request context.
- Handlers cannot fail with undeclared errors — convert infrastructure failures (`SqlError`) with `Effect.orDie` and keep only declared domain errors.
- Global error handling: the router already turns missing routes into 404 and defects into 500 (and logs the cause) but with empty bodies. To return JSON bodies, use `HttpRouter.toHttpEffect` + `Effect.catchCause` before `HttpEffect.toWebHandler` (see 8.6). Note `Effect.catchAllCause` is renamed `Effect.catchCause` in v4.

## Summary

The short version is:

- Define data with `Schema.Class`; define domain failures with `Schema.TaggedError` (annotate HTTP status with `httpApiStatus`).
- Raise failures with `Effect.fail` and recover with `catchTag` / `catchTags`.
- Use `Effect.gen` (and `Effect.fn` / `Effect.fnUntraced`) for readable, reusable effects.
- Keep dependencies explicit with `Context.Service` + `Layer`.
- Define HTTP contracts with `HttpApiGroup` / `HttpApiEndpoint` (object-form options) and implement them with `HttpApiBuilder.group`.
- Do persistence with the generic `SqlClient` (tagged-template queries), provided by a driver layer such as `LibsqlClient.layer`.
- Wire it all into Next.js with `HttpApiBuilder.layer` + `HttpRouter.toWebHandler` in `src/app/api/[[...route]]/route.ts`.
