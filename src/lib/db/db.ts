import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/lib/db/schema";

const sqliteClient = createClient({
  url: "file:tasks.db",
});

export const db = drizzle(sqliteClient, { schema });