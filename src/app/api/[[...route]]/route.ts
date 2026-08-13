import { Effect, Layer } from "effect"
import {
  HttpEffect,
  HttpRouter,
  HttpServer,
  HttpServerError,
  HttpServerResponse
} from "effect/unstable/http"
import { HttpApiBuilder, HttpApiSwagger } from "effect/unstable/httpapi"
import { RootApi } from "@/api"
import { SystemHandlersLive } from "@/api/service"
import { TasksHandlersLive } from "@/features/tasks/handlers"
import { DbLive } from "@/lib/db/client"

// Wire the assembled HttpApi (route definitions + handlers + persistence) into
// a Web handler for Next.js. HttpApiBuilder.layer registers every group on an
// HttpRouter; HttpRouter.toHttpEffect exposes the router as an Effect so we can
// add global error handling before converting it with HttpEffect.toWebHandler.
// The handler/repo layers provide their own dependencies (TasksRepo, SqlClient)
// internally, and are merged here so the resulting app layer is fully
// self-contained with no per-request service requirements.
//swagger router
const swaggerLive=HttpApiSwagger.layer(RootApi,{path: "/api/docs"})
const AppLive = HttpApiBuilder.layer(RootApi).pipe(
  Layer.provideMerge(SystemHandlersLive),
  Layer.provideMerge(TasksHandlersLive),
  Layer.provideMerge(DbLive),
  Layer.provideMerge(swaggerLive)
)

// Global error handling. v4's router already maps failures to responses (missing
// routes -> 404, defects -> 500) and logs the cause, but with an empty body.
// Catching every cause here returns a JSON body with a meaningful status.
//
// A missing route is expected (404) and logged at INFO; only actual failures
// and defects are logged as an unhandled ERROR with the full cause.
const app = Effect.gen(function*() {
  const httpEffect = yield* HttpRouter.toHttpEffect(
    AppLive.pipe(Layer.provide(HttpServer.layerServices))
  )
  return yield* httpEffect.pipe(
    Effect.catchCause((cause) =>
      Effect.gen(function*() {
        const isNotFound = cause.reasons.some(
          (reason) =>
            reason._tag === "Fail" &&
            reason.error instanceof HttpServerError.HttpServerError &&
            reason.error.reason._tag === "RouteNotFound"
        )
        if (isNotFound) {
          yield* Effect.logInfo("Route not found")
          return yield* HttpServerResponse.json(
            { error: "Route not found" },
            { status: 404 }
          )
        }
        yield* Effect.logError("Unhandled server error", cause)
        return yield* HttpServerResponse.json(
          { error: "Internal Server Error" },
          { status: 500 }
        )
      })
    )
  )
})

// HttpEffect.toWebHandler returns a (Request) => Promise<Response> handler.
// Next.js route handlers take (request, context) where context is the params
// object; the Effect handler's second argument is an optional Context of extra
// services, so wrap it to a single-argument function to line up with Next's
// RouteHandlerConfig type.
const handle = (request: Request) => HttpEffect.toWebHandler(app)(request)

export const GET = handle
export const POST = handle
export const PUT = handle
export const DELETE = handle