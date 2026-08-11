// src/api/routes.ts
import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform";
import { HealthResponse, RootInfoResponse } from "./schema";

export class SystemGroup extends HttpApiGroup.make("api")
  .add(
    HttpApiEndpoint.get("health", "/health") // Full path: /api/health
      .addSuccess(HealthResponse)
  )
  .add(
    HttpApiEndpoint.get("info", "/info") // Full path: /api/info
      .addSuccess(RootInfoResponse)
  )
  // Prefix must come AFTER .add() — in this version it only rewrites endpoints
  // already present on the group. Mounted under the Next.js /api/[[...route]]
  // route handler.
  .prefix("/api") {}