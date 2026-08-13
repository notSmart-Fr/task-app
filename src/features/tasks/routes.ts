import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi"
import { CreateTask, Task, TaskNotFound, UpdateTask } from "./schema"

export class TasksGroup extends HttpApiGroup.make("tasks")
  .add(
    HttpApiEndpoint.get("getTasks", "/tasks", {
      success: Schema.Array(Task)
    }),
    HttpApiEndpoint.get("getTaskById", "/tasks/:id", {
      params: { id: Schema.FiniteFromString },
      success: Task,
      error: TaskNotFound
    }),
    HttpApiEndpoint.post("createTask", "/tasks", {
      payload: CreateTask,
      success: Task
    }),
    HttpApiEndpoint.put("updateTask", "/tasks/:id", {
      params: { id: Schema.FiniteFromString },
      payload: UpdateTask,
      success: Task,
      error: TaskNotFound
    }),
    HttpApiEndpoint.delete("deleteTask", "/tasks/:id", {
      params: { id: Schema.FiniteFromString },
      success: HttpApiSchema.NoContent,
      error: TaskNotFound
    })
  )
  // Prefix must come AFTER .add() — it only rewrites endpoints already on the
  // group. Mounted under the Next.js /api/[[...route]] route handler.
  .prefix("/api") {}    
