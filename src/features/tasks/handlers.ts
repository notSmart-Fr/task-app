import { Effect, Layer } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { RootApi } from "@/api"
import { TasksRepo, TasksRepoLive } from "./service"

// Handler implementation for the "tasks" group. The repo service is obtained
// once in the group builder and captured in the handler closures, and the group
// layer provides its own dependencies, so no service leaks into the per-request
// context. Each handler receives the decoded params/payload from the endpoint
// schemas.
export const TasksHandlersLive = HttpApiBuilder.group(
  RootApi,
  "tasks",
  Effect.fn(function*(handlers) {
    const repo = yield* TasksRepo
    return handlers
      .handle("getTasks", () => repo.findAll)
      .handle("getTaskById", ({ params }) => repo.findById(params.id))
      .handle("createTask", ({ payload }) => repo.create(payload))
      .handle("updateTask", ({ params, payload }) => repo.update(params.id, payload))
      .handle("deleteTask", ({ params }) => repo.remove(params.id))
      .handle("searchTasks", ({ query }) => repo.search(query.id, query.title, query.done))
  })
).pipe(
  Layer.provide(TasksRepoLive)
)
