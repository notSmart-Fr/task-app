import { Layer } from "effect"
import { LibsqlClient, LibsqlMigrator } from "@effect/sql-libsql"
import { migrationsLoader } from "./migrations"

const clientLayer = LibsqlClient.layer({ url: "file:tasks.db" })

// Shared database layer: a libSQL-backed SqlClient plus migrations that run at
// layer construction. Provide this layer anywhere persistence is needed.
//
// Note: composing as `client.pipe(Layer.provideMerge(migrator))` does not
// thread SqlClient into the migrator in 4.0.0-beta.107 ("Service not found");
// providing the migrator with the client and then merging the two works.
export const DbLive = Layer.mergeAll(
  clientLayer,
  LibsqlMigrator.layer({ loader: migrationsLoader }).pipe(
    Layer.provide(clientLayer)
  )
)
