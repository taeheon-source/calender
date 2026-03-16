import { Pool } from "pg";

const globalForDb = globalThis;

export function getPool() {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("POSTGRES_URL or DATABASE_URL must be set.");
  }

  if (!globalForDb.__calendarPool) {
    globalForDb.__calendarPool = new Pool({
      connectionString,
      ssl:
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : false,
    });
  }

  return globalForDb.__calendarPool;
}

let schemaReady;

export async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = getPool().query(`
      CREATE TABLE IF NOT EXISTS calendar_events (
        id BIGSERIAL PRIMARY KEY,
        event_date DATE NOT NULL,
        category TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_calendar_events_date
      ON calendar_events (event_date);

      CREATE TABLE IF NOT EXISTS recurring_rules (
        id BIGSERIAL PRIMARY KEY,
        start_date DATE NOT NULL,
        category TEXT NOT NULL,
        content TEXT NOT NULL,
        frequency TEXT NOT NULL,
        pattern_type TEXT NOT NULL,
        occurrence_number INTEGER NOT NULL,
        weekday INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_recurring_rules_start_date
      ON recurring_rules (start_date);
    `);
  }

  await schemaReady;
}
