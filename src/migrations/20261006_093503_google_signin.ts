import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" ADD COLUMN "google_sign_in" boolean DEFAULT false;
  CREATE INDEX "ownerCollection_ownerId_idx" ON "files" USING btree ("owner_collection","owner_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "ownerCollection_ownerId_idx";
  ALTER TABLE "users" DROP COLUMN "google_sign_in";`)
}
