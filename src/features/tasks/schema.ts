import { Schema } from "effect"

// Task entity (row) schema
export class Task extends Schema.Class<Task>("Task")({
  id: Schema.Finite,
  title: Schema.String,
  done: Schema.Boolean
}) {}

// Request payload schemas
export class CreateTask extends Schema.Class<CreateTask>("CreateTask")({
  title: Schema.String,
  done: Schema.optional(Schema.Boolean)
}) {}

export class UpdateTask extends Schema.Class<UpdateTask>("UpdateTask")({
  title: Schema.optional(Schema.String),
  done: Schema.optional(Schema.Boolean)
}) {}

// Tagged domain error, annotated so HttpApi encodes it as a 404
export class TaskNotFound extends Schema.TaggedError<TaskNotFound>()("TaskNotFound", {
  id: Schema.Finite
}, {
  httpApiStatus: 404
}) {}