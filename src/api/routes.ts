// src/api/routes.ts
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { HealthResponse, RootInfoResponse } from "./schema"

export class SystemGroup extends HttpApiGroup.make("api")
  .add(
    HttpApiEndpoint.get("health", "/health", { success: HealthResponse }),
    HttpApiEndpoint.get("info", "/info", { success: RootInfoResponse })
  )
  // Prefix must come AFTER .add() — it only rewrites endpoints already on the
  // group. Mounted under the Next.js /api/[[...route]] route handler.
  .prefix("/api") {}