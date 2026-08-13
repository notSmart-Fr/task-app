import { HttpApi } from "effect/unstable/httpapi"
import { TasksGroup } from "@/features/tasks/routes"
import { SystemGroup } from "./routes"

export const RootApi = HttpApi.make("root").add(SystemGroup).add(TasksGroup)