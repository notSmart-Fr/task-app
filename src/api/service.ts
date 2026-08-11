import { HttpApiBuilder } from "@effect/platform";
import { Effect, Layer } from "effect";
import { RootApi } from "./index";

// Handler implementation for the "api" group
export const SystemHandlerLive = HttpApiBuilder.group(
  RootApi,
  "api",
  (builder) =>
    builder
      .handle("info", () =>
        Effect.succeed({
          name: "Task App",
          version: "1.0.0",
          endpoints: ["/api/info", "/api/health"],
        })
      )
      .handle("health", () =>
        Effect.succeed({ status: "ok" as const })
      )
);

// Combined Root Service Layer
export const AppServiceLive = HttpApiBuilder.api(RootApi).pipe(
  Layer.provide(SystemHandlerLive)
);