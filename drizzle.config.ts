import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/features/tasks/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: "file:tasks.db",
  },
});