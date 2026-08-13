import { Context, Effect, Layer } from "effect"
import { SqlClient } from "effect/unstable/sql/SqlClient"
import { CreateTask, Task, TaskNotFound, UpdateTask } from "./schema"

// Raw row shape returned by the libsql driver (SQLite has no native boolean).
type TaskRow = {
  readonly id: number
  readonly title: string
  readonly done: number
}

// Schema.Class encode validates against the class instance, so rows are mapped
// into real Task instances rather than plain objects.
const toTask = (row: TaskRow): Task => new Task({ id: row.id, title: row.title, done: row.done === 1 })

// Low-level DB failures are converted to defects (surface as a 500) at the
// service boundary; only domain errors remain in the typed error channel.
const orDie = <A, E>(effect: Effect.Effect<A, E>) => effect.pipe(Effect.orDie)

export class TasksRepo extends Context.Service<TasksRepo, {
  readonly findAll: Effect.Effect<ReadonlyArray<Task>>
  readonly findById: (id: number) => Effect.Effect<Task, TaskNotFound>
  readonly create: (input: CreateTask) => Effect.Effect<Task>
  readonly update: (id: number, input: UpdateTask) => Effect.Effect<Task, TaskNotFound>
  readonly remove: (id: number) => Effect.Effect<void, TaskNotFound>
  readonly search: (id?: number, title?: string, done?: boolean) => Effect.Effect<ReadonlyArray<Task>>
}>()("TasksRepo") {}

export const TasksRepoLive = Layer.effect(
  TasksRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient

    return TasksRepo.of({
      findAll: orDie(sql<TaskRow>`SELECT id, title, done FROM tasks ORDER BY id`).pipe(
        Effect.map((rows) => rows.map(toTask))
      ),

      findById: (id) =>
        Effect.gen(function* () {
          const rows = yield* orDie(sql<TaskRow>`SELECT id, title, done FROM tasks WHERE id = ${id}`)
          const row = rows[0]
          return row === undefined ? yield* new TaskNotFound({ id }) : toTask(row)
        }),

      create: (input) =>
        Effect.gen(function* () {
          const rows = yield* orDie(
            sql<TaskRow>`INSERT INTO tasks (title, done) VALUES (${input.title}, ${input.done ? 1 : 0}) RETURNING id, title, done`
          )
          const row = rows[0]
          if (row === undefined) {
            return yield* Effect.die(new Error("Database failed to return inserted row"))
          }
          return toTask(row)
        }),

      update: (id, input) =>
        Effect.gen(function* () {
          const rows = yield* orDie(sql<TaskRow>`
            UPDATE tasks
            SET title = COALESCE(${input.title ?? null}, title),
                done = COALESCE(${input.done == null ? null : input.done ? 1 : 0}, done)
            WHERE id = ${id}
            RETURNING id, title, done
          `)
          const row = rows[0]
          return row === undefined ? yield* new TaskNotFound({ id }) : toTask(row)
        }),

      remove: (id) =>
        Effect.gen(function* () {
          const result = yield* orDie(sql`DELETE FROM tasks WHERE id = ${id}`.raw)
          if ((result as { rowsAffected: number }).rowsAffected === 0) {
            return yield* new TaskNotFound({ id })
          }
          return yield* Effect.void
        }),

      search: (id?: number, title?: string, done?: boolean) =>
        Effect.gen(function* () {
          const rows = yield* orDie(sql<TaskRow>`
            SELECT id, title, done FROM tasks WHERE 1=1
            ${id !== undefined ? sql`AND id = ${id}` : sql``}
            ${title !== undefined ? sql`AND title LIKE '%' || ${title} || '%'` : sql``}
            ${done !== undefined ? sql`AND done = ${done ? 1 : 0}` : sql``}
            ORDER BY id
          `)
          return rows.map(toTask)
        })
    })
  })
)
