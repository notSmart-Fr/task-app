import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { RootApi } from "./index"
import { HealthResponse, RootInfoResponse } from "./schema"

// Handler implementation for the "api" group.
export const SystemHandlersLive = HttpApiBuilder.group(
  RootApi,
  "api",
  (handlers) =>
    handlers
      .handle("info", () =>
        Effect.succeed(
          new RootInfoResponse({
            name: "Task App",
            version: "1.0.0",
            endpoints: ["/api/info", "/api/health"]
          })
        )
      )
      .handle("health", () => Effect.succeed(new HealthResponse({ status: "ok" })))
)