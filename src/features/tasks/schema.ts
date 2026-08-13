import { Schema } from "effect"

// Task entity (row) schema
export class Task extends Schema.Class<Task>("Task")({
  id: Schema.Finite.annotate(
    { title: "Task ID",
    description: "Unique numeric identifier for the task",
    examples: [1, 42] }
  ),
  title: Schema.String.annotate(
    { title: "Task Title",
    description: "Brief summary of what needs to be done",
    examples: ["Buy groceries", "Write unit tests"] }
  ),
  done: Schema.Boolean.annotate({
    description: "Whether the task is completed or pending",
    examples: [false]
  })
}) {}

// Request payload schemas
export class CreateTask extends Schema.Class<CreateTask>("CreateTask")({
  title: Schema.String.annotate({ description: "Title of the task" }),
  done: Schema.optional(Schema.Boolean).annotate({ description: "Completion status of the task" })
}) {}

export class UpdateTask extends Schema.Class<UpdateTask>("UpdateTask")({
  title: Schema.optional(Schema.String).annotate({ description: "Title of the task" }),
  done: Schema.optional(Schema.Boolean).annotate({ description: "Completion status of the task" })
}) {}

export class TaskQuery extends Schema.Class<TaskQuery>("TaskQuery")({
  id: Schema.optional(Schema.Finite).annotate({ description: "Filter tasks by ID", examples: [1, 42] }),
  title: Schema.optional(Schema.String).annotate({ description: "Filter tasks by title" }),
  done: Schema.optional(Schema.Boolean).annotate({ description: "Filter tasks by completion status" })
}) {}

// Tagged domain error, annotated so HttpApi encodes it as a 404
export class TaskNotFound extends Schema.TaggedError<TaskNotFound>()("TaskNotFound", {
  id: Schema.Finite.annotate({ description: "Unique identifier for the task" }),
  title: Schema.optional(Schema.String).annotate({ description: "Title of the task" }),
  done: Schema.optional(Schema.Boolean).annotate({ description: "Completion status of the task" })
}, {
  httpApiStatus: 404
}) {}

export class TaskAlreadyExists extends Schema.TaggedError<TaskAlreadyExists>()("TaskAlreadyExists", {
  title: Schema.String.annotate({ description: "Title of the task" })
}, {
  httpApiStatus: 409
}) {}

export class TaskValidationError extends Schema.TaggedError<TaskValidationError>()("TaskValidationError", {
  title: Schema.String.annotate({ description: "Title of the task" })
}, {
  httpApiStatus: 400
}) {}
  