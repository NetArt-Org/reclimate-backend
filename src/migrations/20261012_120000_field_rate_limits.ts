import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/** Request counters for the field API's rate limits (see src/field/ratelimit.ts). Not a Payload collection. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "field_rate_limits" ("key" text PRIMARY KEY, "window_start" timestamptz NOT NULL, "count" integer NOT NULL);
    CREATE INDEX IF NOT EXISTS "field_rate_limits_window_idx" ON "field_rate_limits" USING btree ("window_start");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "field_rate_limits";`)
}
