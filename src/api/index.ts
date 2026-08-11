import { HttpApi } from "@effect/platform";
import { SystemGroup } from "./routes";

export const RootApi = HttpApi.make("root").add(SystemGroup);