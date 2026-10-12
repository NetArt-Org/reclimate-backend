import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/** Replies to field-app writes, by the app's own id, so a resent request is not applied twice (src/field/idempotency.ts). */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "field_idempotency" ("key" text PRIMARY KEY, "reply" jsonb, "at" timestamptz NOT NULL DEFAULT now());
    CREATE INDEX IF NOT EXISTS "field_idempotency_at_idx" ON "field_idempotency" USING btree ("at");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "field_idempotency";`)
}
