import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "vehicles" ADD COLUMN "active" boolean DEFAULT true;
  ALTER TABLE "containers" ADD COLUMN "active" boolean DEFAULT true;
  ALTER TABLE "feedstocks" ADD COLUMN "active" boolean DEFAULT true;
  ALTER TABLE "batches" ADD COLUMN "voided" boolean DEFAULT false;
  ALTER TABLE "batches" ADD COLUMN "void_reason" varchar;
  ALTER TABLE "batches" ADD COLUMN "voided_by" varchar;
  ALTER TABLE "batches" ADD COLUMN "voided_at" timestamp(3) with time zone;
  ALTER TABLE "biomass_collections" ADD COLUMN "voided" boolean DEFAULT false;
  ALTER TABLE "biomass_collections" ADD COLUMN "void_reason" varchar;
  ALTER TABLE "biomass_collections" ADD COLUMN "voided_by" varchar;
  ALTER TABLE "biomass_collections" ADD COLUMN "voided_at" timestamp(3) with time zone;
  ALTER TABLE "mixings" ADD COLUMN "voided" boolean DEFAULT false;
  ALTER TABLE "mixings" ADD COLUMN "void_reason" varchar;
  ALTER TABLE "mixings" ADD COLUMN "voided_by" varchar;
  ALTER TABLE "mixings" ADD COLUMN "voided_at" timestamp(3) with time zone;
  ALTER TABLE "packagings" ADD COLUMN "voided" boolean DEFAULT false;
  ALTER TABLE "packagings" ADD COLUMN "void_reason" varchar;
  ALTER TABLE "packagings" ADD COLUMN "voided_by" varchar;
  ALTER TABLE "packagings" ADD COLUMN "voided_at" timestamp(3) with time zone;
  ALTER TABLE "inventories" ADD COLUMN "voided" boolean DEFAULT false;
  ALTER TABLE "inventories" ADD COLUMN "void_reason" varchar;
  ALTER TABLE "inventories" ADD COLUMN "voided_by" varchar;
  ALTER TABLE "inventories" ADD COLUMN "voided_at" timestamp(3) with time zone;
  ALTER TABLE "applications" ADD COLUMN "voided" boolean DEFAULT false;
  ALTER TABLE "applications" ADD COLUMN "void_reason" varchar;
  ALTER TABLE "applications" ADD COLUMN "voided_by" varchar;
  ALTER TABLE "applications" ADD COLUMN "voided_at" timestamp(3) with time zone;
  ALTER TABLE "activity_logs" ADD COLUMN "by_email" varchar;
  ALTER TABLE "activity_logs" ADD COLUMN "entity" varchar;
  ALTER TABLE "activity_logs" ADD COLUMN "entity_id" varchar;
  ALTER TABLE "activity_logs" ADD COLUMN "changes" jsonb;
  CREATE INDEX "batches_voided_idx" ON "batches" USING btree ("voided");
  CREATE INDEX "biomass_collections_voided_idx" ON "biomass_collections" USING btree ("voided");
  CREATE INDEX "mixings_voided_idx" ON "mixings" USING btree ("voided");
  CREATE INDEX "packagings_voided_idx" ON "packagings" USING btree ("voided");
  CREATE INDEX "inventories_voided_idx" ON "inventories" USING btree ("voided");
  CREATE INDEX "applications_voided_idx" ON "applications" USING btree ("voided");
  CREATE INDEX "activity_logs_entity_idx" ON "activity_logs" USING btree ("entity");
  CREATE INDEX "activity_logs_entity_id_idx" ON "activity_logs" USING btree ("entity_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "batches_voided_idx";
  DROP INDEX "biomass_collections_voided_idx";
  DROP INDEX "mixings_voided_idx";
  DROP INDEX "packagings_voided_idx";
  DROP INDEX "inventories_voided_idx";
  DROP INDEX "applications_voided_idx";
  DROP INDEX "activity_logs_entity_idx";
  DROP INDEX "activity_logs_entity_id_idx";
  ALTER TABLE "vehicles" DROP COLUMN "active";
  ALTER TABLE "containers" DROP COLUMN "active";
  ALTER TABLE "feedstocks" DROP COLUMN "active";
  ALTER TABLE "batches" DROP COLUMN "voided";
  ALTER TABLE "batches" DROP COLUMN "void_reason";
  ALTER TABLE "batches" DROP COLUMN "voided_by";
  ALTER TABLE "batches" DROP COLUMN "voided_at";
  ALTER TABLE "biomass_collections" DROP COLUMN "voided";
  ALTER TABLE "biomass_collections" DROP COLUMN "void_reason";
  ALTER TABLE "biomass_collections" DROP COLUMN "voided_by";
  ALTER TABLE "biomass_collections" DROP COLUMN "voided_at";
  ALTER TABLE "mixings" DROP COLUMN "voided";
  ALTER TABLE "mixings" DROP COLUMN "void_reason";
  ALTER TABLE "mixings" DROP COLUMN "voided_by";
  ALTER TABLE "mixings" DROP COLUMN "voided_at";
  ALTER TABLE "packagings" DROP COLUMN "voided";
  ALTER TABLE "packagings" DROP COLUMN "void_reason";
  ALTER TABLE "packagings" DROP COLUMN "voided_by";
  ALTER TABLE "packagings" DROP COLUMN "voided_at";
  ALTER TABLE "inventories" DROP COLUMN "voided";
  ALTER TABLE "inventories" DROP COLUMN "void_reason";
  ALTER TABLE "inventories" DROP COLUMN "voided_by";
  ALTER TABLE "inventories" DROP COLUMN "voided_at";
  ALTER TABLE "applications" DROP COLUMN "voided";
  ALTER TABLE "applications" DROP COLUMN "void_reason";
  ALTER TABLE "applications" DROP COLUMN "voided_by";
  ALTER TABLE "applications" DROP COLUMN "voided_at";
  ALTER TABLE "activity_logs" DROP COLUMN "by_email";
  ALTER TABLE "activity_logs" DROP COLUMN "entity";
  ALTER TABLE "activity_logs" DROP COLUMN "entity_id";
  ALTER TABLE "activity_logs" DROP COLUMN "changes";`)
}
