import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Staff already in the system (migrated from Circonomy) get app access, so they sign in without anyone handing out
 * passwords: "Continue with Google", or "Forgot password" to choose their own (src/field/account.ts prepareReset).
 * Their login is linked on first sign-in. Only staff with an email of their own: not farmers, inactive people,
 * sign-ups, emails shared by two people or admin-panel emails. People with only a phone sign up in the app.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "people" p SET "app_access" = true
    WHERE p."active" AND p."firebase_uid" IS NULL AND NOT coalesce(p."app_access", false)
      AND p."role" IN ('operator', 'supervisor', 'manager')
      AND coalesce(p."registration_status"::text, '') NOT IN ('pending', 'rejected')
      AND trim(p."email") ~* '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$'
      AND NOT EXISTS (SELECT 1 FROM "users" u WHERE lower(u."email") = lower(trim(p."email")))
      AND (SELECT count(*) FROM "people" q WHERE lower(trim(q."email")) = lower(trim(p."email"))) = 1;`)
}

/** Nothing to undo safely: an admin may have changed app access since. */
export async function down(_: MigrateDownArgs): Promise<void> {}
