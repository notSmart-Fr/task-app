import { HttpApiSchema } from "@effect/platform";
import{Schema} from "effect";
// task entity schema
export class TaskSchema extends Schema.Class<TaskSchema>("TaskSchema")({
  id: Schema.String,
  title: Schema.String,
  completed: Schema.Boolean,
}) {}

export const TaskListSchema = Schema.Array(TaskSchema);

//req payload
export class CreateTaskPayloadSchema extends Schema.Class<CreateTaskPayloadSchema>("CreateTaskPayloadSchema")({
  title: Schema.String,
  completed: Schema.Boolean,
}) {}

export class UpdateTaskPayloadSchema extends Schema.Class<UpdateTaskPayloadSchema>("UpdateTaskPayloadSchema")({
  title: Schema.optional(Schema.String),
  completed: Schema.optional(Schema.Boolean),
}) {}

// Tagged errors (mapped to HTTP status codes)
export class TaskNotFoundError extends Schema.TaggedError<TaskNotFoundError>()(
  "TaskNotFoundError",
  { error: Schema.String },
  HttpApiSchema.annotations({ status: 404 }) // 404 Not Found
) {}

export class TaskAlreadyExistsError extends Schema.TaggedError<TaskAlreadyExistsError>()(
  "TaskAlreadyExistsError",
  { error: Schema.String },
  HttpApiSchema.annotations({ status: 409 }) // 409 Conflict
) {}

export class ValidationError extends Schema.TaggedError<ValidationError>()(
  "ValidationError",
  { error: Schema.String },
  HttpApiSchema.annotations({ status: 400 }) // 400 Bad Request
) {}