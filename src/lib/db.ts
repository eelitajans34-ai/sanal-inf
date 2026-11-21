import { drizzle } from "drizzle-orm/libsql";
import { createClient, type Client } from "@libsql/client";
import * as schema from "@/db/schema";

// Yerelde: DATABASE_URL="file:./data.db"
// Canlıda: Turso → DATABASE_URL="libsql://...turso.io" + DATABASE_AUTH_TOKEN
const globalForDb = globalThis as unknown as { libsql?: Client };

const client =
  globalForDb.libsql ??
  createClient({
    url: process.env.DATABASE_URL || "file:./data.db",
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  });

if (process.env.NODE_ENV !== "production") globalForDb.libsql = client;

export const db = drizzle(client, { schema });
export { schema };
