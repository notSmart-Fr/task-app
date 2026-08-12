import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform";
import { Schema } from "effect";
import { TaskListSchema, TaskNotFoundError, TaskAlreadyExistsError, TaskSchema, ValidationError } from "./schema";

export class TaskGroup extends HttpApiGroup.make("tasks")
  // GET /tasks
  .add(HttpApiEndpoint.get("getTasks", "/tasks").addSuccess(TaskListSchema))
  //Get /tasks/:id
  .add(HttpApiEndpoint.get("getTaskById", "/tasks/:id")
    .setPath(Schema.Struct({ id: Schema.NumberFromString }))
    .addSuccess(TaskSchema))
    .addError(TaskNotFoundError)
    .addError(TaskAlreadyExistsError)
    .addError(ValidationError)
    // POST /tasks
  .add(HttpApiEndpoint.post("createTask", "/tasks")
    .setPayload(Schema.Struct({ title: Schema.String, completed: Schema.Boolean }))
    .addSuccess(TaskSchema))
    .addError(ValidationError)
        
// PUT /tasks/:id
  .add(HttpApiEndpoint.put("updateTask", "/tasks/:id")
    .setPath(Schema.Struct({ id: Schema.NumberFromString }))
    .setPayload(Schema.Struct({ title: Schema.optional(Schema.String), completed: Schema.optional(Schema.Boolean) }))
    .addSuccess(TaskSchema))
    .addError(TaskNotFoundError)
    .addError(ValidationError)
// DELETE /tasks/:id
  .add(HttpApiEndpoint.del("deleteTask", "/tasks/:id")
    .setPath(Schema.Struct({ id: Schema.NumberFromString }))
    .addSuccess(Schema.Void))
    .addError(TaskNotFoundError)
    .addError(ValidationError)
  // Prefix must come AFTER .add() — in this version it only rewrites endpoints
  // already present on the group. Mounted under the Next.js /api/[[...route]]
  // route handler.
  .prefix("/api") {}    
