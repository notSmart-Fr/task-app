import { Effect } from "effect"
import * as Migrator from "effect/unstable/sql/Migrator"
import { SqlClient } from "effect/unstable/sql/SqlClient"

// Inline, bundle-safe migrations. Each entry is keyed "<id>_<name>" and runs in
// order inside a transaction. The migrator records applied ids in the
// `effect_sql_migrations` table, so running this repeatedly is a no-op.
const migrations: Record<string, Effect.Effect<void, unknown, SqlClient>> = {
  "1_init_tasks": Effect.gen(function*() {
    const sql = yield* SqlClient
    yield* sql`CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0
    )`
  })
}

export const migrationsLoader = Migrator.fromRecord(migrations)
