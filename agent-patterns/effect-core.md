# Effect core patterns for this repository

This note captures the idiomatic patterns used in the vendored Effect codebase for schema modeling, typed errors, generators, and HttpApi definitions.

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
      payload: { search: Schema.String },
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

## 8. HttpApi / HttpApp route handlers: common wiring mistakes

Route handlers in the app router are a frequent source of friction. The following mistakes have been hit in this repository and should be avoided.

### Name the file `route.ts`, not `routes.ts`

Next.js App Router only treats a file named `route.ts` inside a route segment as a route handler. A file named `routes.ts` is silently ignored and the server returns a 404.

```text
// ❌ Wrong - Next.js ignores this
src/app/api/[[...route]]/routes.ts

// ✅ Correct - Next.js treats this as the route handler
src/app/api/[[...route]]/route.ts
```

### Read the request from the HttpServerRequest tag, not Effect.service

The `HttpServerRequest` context tag is itself directly yieldable. Do not use `Effect.service(...)` — it does not exist in current Effect versions and produces a type error.

```ts
// ❌ Wrong - Effect.service does not exist
const request = yield* Effect.service(HttpServerRequest.HttpServerRequest)

// ✅ Correct - yield the tag directly
const request = yield* HttpServerRequest.HttpServerRequest
```

### Do not hard-code a single response for every route

A catch-all handler should route on the request path rather than returning the same payload for every URL.

```ts
import { HttpApp, HttpServerRequest, HttpServerResponse } from "@effect/platform"
import { Effect } from "effect"

const app: HttpApp.Default = Effect.gen(function*() {
  const request = yield* HttpServerRequest.HttpServerRequest
  const path = new URL(request.url).pathname

  if (path === "/api/info") {
    return HttpServerResponse.text(JSON.stringify({ status: "info", route: path }), {
      status: 200,
      contentType: "application/json"
    })
  }

  return HttpServerResponse.text(JSON.stringify({ status: "ok", route: path }), {
    status: 200,
    contentType: "application/json"
  })
})

const handler = HttpApp.toWebHandler(app)

export const GET = handler
export const POST = handler
export const PUT = handler
export const DELETE = handler
```

### Build responses with the HttpServerResponse constructors

Do not mutate responses with methods that do not exist on `HttpServerResponse`. Use the constructor helpers such as `text`, `json`, `uint8Array`, and `empty`.

```ts
// ❌ Wrong - withBody does not exist on HttpServerResponse
HttpServerResponse.empty({ status: 200 }).withBody(...)

// ✅ Correct - use a constructor
HttpServerResponse.text(JSON.stringify({ status: "ok" }), {
  status: 200,
  contentType: "application/json"
})
```

### Summary of route-handler rules

- Name the handler file `route.ts`.
- Yield `HttpServerRequest.HttpServerRequest` directly to read the request.
- Route on the request path instead of returning a fixed response.
- Build responses with `HttpServerResponse` constructors, not ad-hoc mutation.

## Summary

The short version is:

- Define data with Schema.Class.
- Define domain failures with Schema.TaggedError.
- Raise failures with Effect.fail and recover with catchTag / catchTags.
- Use Effect.gen for readable effect workflows with yield*.
- Prefer reusable helpers with Effect.fn / Effect.fnUntraced.
- Keep dependencies explicit with Context.Service and Layer.
- Describe HTTP contracts with HttpApi and HttpApiSchema, not with manual exception handling.
