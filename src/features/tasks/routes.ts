import { Schema } from "effect"
import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
  OpenApi
} from "effect/unstable/httpapi"
import { CreateTask, Task, TaskNotFound, UpdateTask, TaskQuery } from "./schema"

export class TasksGroup extends HttpApiGroup.make("tasks")
  .add(
    HttpApiEndpoint.get("getTasks", "/tasks", {
      success: Schema.Array(Task)
    }).annotate(OpenApi.Title, "List all tasks")
      .annotate(OpenApi.Description, "Fetches an array of all tasks stored in the system."),

    HttpApiEndpoint.get("getTaskById", "/tasks/:id", {
      params: { id: Schema.FiniteFromString },
      success: Task,
      error: TaskNotFound
    }).annotate(OpenApi.Title, "Get task by ID")
      .annotate(OpenApi.Description, "Returns a single task matching the given numeric ID."),

    HttpApiEndpoint.post("createTask", "/tasks", {
      payload: CreateTask,
      success: Task
    }).annotate(OpenApi.Title, "Create new task")
      .annotate(OpenApi.Description, "Adds a new task to the database."),

    HttpApiEndpoint.put("updateTask", "/tasks/:id", {
      params: { id: Schema.FiniteFromString },
      payload: UpdateTask,
      success: Task,
      error: TaskNotFound
    }).annotate(OpenApi.Title, "Update existing task")
      .annotate(OpenApi.Description, "Updates specific fields of an existing task by ID."),

    HttpApiEndpoint.delete("deleteTask", "/tasks/:id", {
      params: { id: Schema.FiniteFromString },
      success: HttpApiSchema.NoContent,
      error: TaskNotFound
    }).annotate(OpenApi.Title, "Delete task")
      .annotate(OpenApi.Description, "Permanently removes a task from the database by ID."),

    HttpApiEndpoint.get("searchTasks", "/tasks/search", {
      query: TaskQuery,
      success: Schema.Array(Task)
    }).annotate(OpenApi.Title, "Search tasks")
      .annotate(OpenApi.Description, "Searches for tasks matching the given query parameters."),
  ) 
    
  .annotate(OpenApi.Title, "Tasks Management")
  .annotate(OpenApi.Description, "Endpoints for managing task items.")
  .prefix("/api") {}