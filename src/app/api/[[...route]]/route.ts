import {
  HttpApiBuilder,
  HttpApp,
  HttpServer,
  HttpServerError,
  HttpServerResponse
} from "@effect/platform";
import { Cause, Effect, Layer } from "effect";
import { AppServiceLive } from "@/api/service";

// Wire the assembled HttpApi layer (route definitions + handlers) into a Web
// handler for Next.js. The HttpApi definitions in src/api are the single source
// of truth for paths, schemas, and responses.
//
// We build the HttpApp from HttpApiBuilder.httpApp so we can handle errors in
// the effect's error channel (the idiomatic Effect way) instead of inspecting
// the raw Response afterwards.
//
// HttpApiBuilder.httpApp requires the router's default platform services
// (HttpPlatform, FileSystem, Generator, Path), the router, and the middleware
// service, so we merge those layers in.
const app = HttpApiBuilder.httpApp.pipe(
  Effect.map((httpApp) =>
    httpApp.pipe(
      // Unmatched routes surface as a RouteNotFound cause. Return a meaningful
      // JSON 404 instead of the router's default empty body. The typed error
      // channel is erased here, so we narrow defensively via the runtime _tag
      // (guarding against non-object errors) before casting.
      Effect.catchAllCause((cause) => {
        if (Cause.isFailType(cause)) {
          const error: unknown = cause.error;
          if (
            typeof error === "object" &&
            error !== null &&
            "_tag" in error &&
            (error as { _tag?: string })._tag === "RouteNotFound"
          ) {
            const routeNotFound = error as HttpServerError.RouteNotFound;
            return HttpServerResponse.json(
              { error: "Route not found", path: routeNotFound.request.url },
              { status: 404 }
            );
          }
        }
        // Re-throw everything else.
        return Effect.failCause(cause);
      }),
      // Catch every remaining failure (typed errors and defects), log the real
      // cause, and return a meaningful response instead of an empty 500.
      Effect.catchAllCause((cause) =>
        Effect.gen(function*() {
          yield* Effect.logError(`Request failed: ${Cause.pretty(cause)}`);
          return HttpServerResponse.text(
            JSON.stringify({ error: "internal", message: "Internal Server Error" }),
            { status: 500, contentType: "application/json" }
          );
        })
      )
    )
  )
);

const { handler } = HttpApp.toWebHandlerLayerWith(
  Layer.mergeAll(
    AppServiceLive,
    HttpServer.layerContext,
    HttpApiBuilder.Router.Live,
    HttpApiBuilder.Middleware.layer
  ),
  {
    toHandler: (runtime) => Effect.provide(app, runtime)
  }
);

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;