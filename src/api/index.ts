import { HttpApi, OpenApi } from "effect/unstable/httpapi"
import { TasksGroup } from "@/features/tasks/routes"
import { SystemGroup } from "./routes"

export const RootApi = HttpApi.make("root").add(SystemGroup).add(TasksGroup).annotate(OpenApi.Title, "Task App API").annotate(OpenApi.Description, "API endpoints for the Task App.")