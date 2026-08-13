import { Schema } from "effect";

export class HealthResponse extends Schema.Class<HealthResponse>("HealthResponse")({
  status: Schema.Literal("ok"),
}) {}
export class RootInfoResponse extends Schema.Class<RootInfoResponse>("RootInfoResponse")({
  name: Schema.String,
  version: Schema.String,
  endpoints: Schema.Array(Schema.String),
}) {}