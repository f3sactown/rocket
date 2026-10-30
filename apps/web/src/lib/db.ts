import { createDb } from "@rocket/db";

const globalForDb = globalThis as unknown as {
  db?: ReturnType<typeof createDb>;
};

// Reuse one connection pool across hot reloads in development.
export const db = globalForDb.db ?? createDb();
if (process.env.NODE_ENV !== "production") globalForDb.db = db;
