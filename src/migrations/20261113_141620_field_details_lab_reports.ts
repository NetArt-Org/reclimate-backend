import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_lab_reports_kind" AS ENUM('bulk-density', 'analysis');
  CREATE TABLE "lab_reports" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"feedstock_id" varchar NOT NULL,
  	"network_id" varchar NOT NULL,
  	"kind" "enum_lab_reports_kind" NOT NULL,
  	"report_date" timestamp(3) with time zone NOT NULL,
  	"file_id" varchar,
  	"bulk_density" numeric,
  	"carbon_total" numeric,
  	"carbon_organic" numeric,
  	"carbon_inorganic" numeric,
  	"hydrogen" numeric,
  	"hc_ratio" numeric,
  	"ash" numeric,
  	"ph" numeric,
  	"water_holding_capacity" numeric,
  	"nitrogen" numeric,
  	"sulphur" numeric,
  	"fixed_carbon" numeric,
  	"produced_m3" numeric,
  	"note" varchar,
  	"uploaded_by" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "documents" ADD COLUMN "organization_id" varchar;
  ALTER TABLE "site_lists" ADD COLUMN "data" jsonb;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "lab_reports_id" varchar;
  ALTER TABLE "lab_reports" ADD CONSTRAINT "lab_reports_feedstock_id_feedstocks_id_fk" FOREIGN KEY ("feedstock_id") REFERENCES "public"."feedstocks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "lab_reports" ADD CONSTRAINT "lab_reports_network_id_networks_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."networks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "lab_reports" ADD CONSTRAINT "lab_reports_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "lab_reports_feedstock_idx" ON "lab_reports" USING btree ("feedstock_id");
  CREATE INDEX "lab_reports_network_idx" ON "lab_reports" USING btree ("network_id");
  CREATE INDEX "lab_reports_kind_idx" ON "lab_reports" USING btree ("kind");
  CREATE INDEX "lab_reports_file_idx" ON "lab_reports" USING btree ("file_id");
  CREATE INDEX "lab_reports_updated_at_idx" ON "lab_reports" USING btree ("updated_at");
  CREATE INDEX "lab_reports_created_at_idx" ON "lab_reports" USING btree ("created_at");
  ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_lab_reports_fk" FOREIGN KEY ("lab_reports_id") REFERENCES "public"."lab_reports"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "documents_organization_idx" ON "documents" USING btree ("organization_id");
  CREATE INDEX "payload_locked_documents_rels_lab_reports_id_idx" ON "payload_locked_documents_rels" USING btree ("lab_reports_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "lab_reports" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "lab_reports" CASCADE;
  ALTER TABLE "documents" DROP CONSTRAINT "documents_organization_id_organizations_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_lab_reports_fk";
  
  DROP INDEX "documents_organization_idx";
  DROP INDEX "payload_locked_documents_rels_lab_reports_id_idx";
  ALTER TABLE "documents" DROP COLUMN "organization_id";
  ALTER TABLE "site_lists" DROP COLUMN "data";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "lab_reports_id";
  DROP TYPE "public"."enum_lab_reports_kind";`)
}
