import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_people_registration_status" AS ENUM('none', 'pending', 'approved', 'rejected');
  ALTER TABLE "people" ADD COLUMN "registration_status" "enum_people_registration_status" DEFAULT 'none';
  ALTER TABLE "people" ADD COLUMN "registration_note" varchar;
  ALTER TABLE "mixings" ADD COLUMN "feedstock" varchar;
  ALTER TABLE "applications" ADD COLUMN "quantity" numeric;
  ALTER TABLE "applications" ADD COLUMN "quantity_unit" varchar;
  ALTER TABLE "applications" ADD COLUMN "bag_type" varchar;
  ALTER TABLE "applications" ADD COLUMN "bags" numeric;
  CREATE INDEX "people_registration_status_idx" ON "people" USING btree ("registration_status");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "people_registration_status_idx";
  ALTER TABLE "people" DROP COLUMN "registration_status";
  ALTER TABLE "people" DROP COLUMN "registration_note";
  ALTER TABLE "mixings" DROP COLUMN "feedstock";
  ALTER TABLE "applications" DROP COLUMN "quantity";
  ALTER TABLE "applications" DROP COLUMN "quantity_unit";
  ALTER TABLE "applications" DROP COLUMN "bag_type";
  ALTER TABLE "applications" DROP COLUMN "bags";
  DROP TYPE "public"."enum_people_registration_status";`)
}
