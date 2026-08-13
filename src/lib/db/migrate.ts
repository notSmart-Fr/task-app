import { Effect, Layer } from "effect"
import { DbLive } from "./client"

// Standalone migration runner: `pnpm db:migrate` (tsx executes this file).
// Building DbLive runs any pending migrations (see lib/db/migrations.ts).
const program = Effect.scoped(
  Effect.gen(function*() {
    yield* Layer.build(DbLive)
    yield* Effect.log("Migrations applied")
  })
).pipe(
  // Log failures through the Effect logger (not console) while keeping the
  // failure so the process exits non-zero.
  Effect.tapError((error) => Effect.logError("Migration failed", error))
)

Effect.runPromise(program).then(
  () => process.exit(0),
  () => process.exit(1)
)
