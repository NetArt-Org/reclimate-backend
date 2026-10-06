import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_containers_kind" AS ENUM('measuring', 'sampling');
  CREATE TYPE "public"."enum_files_status" AS ENUM('stored', 'pending', 'failed');
  CREATE TABLE "containers" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"kind" "enum_containers_kind" NOT NULL,
  	"site_id" varchar,
  	"network_id" varchar,
  	"code" varchar,
  	"name" varchar,
  	"shape" varchar,
  	"dimensions" jsonb,
  	"volume_l" numeric,
  	"in_use" boolean DEFAULT false,
  	"filled" boolean DEFAULT false,
  	"added_at" timestamp(3) with time zone,
  	"raw" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "biomass_sources" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"site_id" varchar,
  	"network_id" varchar,
  	"name" varchar NOT NULL,
  	"address" varchar,
  	"lat" numeric,
  	"lng" numeric,
  	"active" boolean DEFAULT true,
  	"kml" jsonb,
  	"raw" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "inventories" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"code" varchar,
  	"network_id" varchar,
  	"site_id" varchar,
  	"packaging_type" varchar,
  	"bag_type" varchar,
  	"bag_quantity" numeric,
  	"bag_unit" varchar,
  	"actual_quantity" numeric,
  	"packed_at" timestamp(3) with time zone,
  	"status" varchar,
  	"raw" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "inventories_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" varchar NOT NULL,
  	"path" varchar NOT NULL,
  	"batches_id" varchar
  );
  
  CREATE TABLE "applications" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"network_id" varchar,
  	"site_id" varchar,
  	"recipient_name" varchar,
  	"recipient_phone" varchar,
  	"recipient_address" varchar,
  	"lat" numeric,
  	"lng" numeric,
  	"mix_types" jsonb,
  	"mode" varchar,
  	"vehicle" varchar,
  	"kind" varchar,
  	"open" boolean DEFAULT false,
  	"fully_sinked" boolean DEFAULT false,
  	"raw" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "users_sessions" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "users_sessions" CASCADE;
  DROP INDEX "users_username_idx";
  ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL;
  ALTER TABLE "files" ALTER COLUMN "size" DROP NOT NULL;
  ALTER TABLE "files" ALTER COLUMN "data" DROP NOT NULL;
  ALTER TABLE "users" ADD COLUMN "firebase_uid" varchar;
  ALTER TABLE "users" ADD COLUMN "photo_url" varchar;
  ALTER TABLE "users" ADD COLUMN "disabled" boolean DEFAULT false;
  ALTER TABLE "users" ADD COLUMN "last_sign_in_at" timestamp(3) with time zone;
  ALTER TABLE "organizations" ADD COLUMN "raw" jsonb;
  ALTER TABLE "networks" ADD COLUMN "address" varchar;
  ALTER TABLE "networks" ADD COLUMN "country" varchar;
  ALTER TABLE "networks" ADD COLUMN "methane_strategy" varchar;
  ALTER TABLE "networks" ADD COLUMN "raw" jsonb;
  ALTER TABLE "sites" ADD COLUMN "address" varchar;
  ALTER TABLE "sites" ADD COLUMN "kml" jsonb;
  ALTER TABLE "sites" ADD COLUMN "raw" jsonb;
  ALTER TABLE "kilns" ADD COLUMN "shape" varchar;
  ALTER TABLE "kilns" ADD COLUMN "dimensions" jsonb;
  ALTER TABLE "kilns" ADD COLUMN "raw" jsonb;
  ALTER TABLE "people" ADD COLUMN "address" varchar;
  ALTER TABLE "people" ADD COLUMN "raw" jsonb;
  ALTER TABLE "vehicles" ADD COLUMN "site_id" varchar;
  ALTER TABLE "vehicles" ADD COLUMN "name" varchar;
  ALTER TABLE "vehicles" ADD COLUMN "type" varchar;
  ALTER TABLE "vehicles" ADD COLUMN "raw" jsonb;
  ALTER TABLE "batches" ADD COLUMN "assessed_at" timestamp(3) with time zone;
  ALTER TABLE "batches" ADD COLUMN "temperature_c" numeric;
  ALTER TABLE "batches" ADD COLUMN "moisture_readings" jsonb;
  ALTER TABLE "batches" ADD COLUMN "co2_emission_kg" numeric;
  ALTER TABLE "batches" ADD COLUMN "methane_emission_kg" numeric;
  ALTER TABLE "batches" ADD COLUMN "short_term_sink_t" numeric;
  ALTER TABLE "batches" ADD COLUMN "kiln_volume_l" numeric;
  ALTER TABLE "batches" ADD COLUMN "sampling_container_id" varchar;
  ALTER TABLE "batches" ADD COLUMN "raw" jsonb;
  ALTER TABLE "biomass_collections" ADD COLUMN "biomass_source_id" varchar;
  ALTER TABLE "biomass_collections" ADD COLUMN "raw" jsonb;
  ALTER TABLE "mixings" ADD COLUMN "raw" jsonb;
  ALTER TABLE "packagings" ADD COLUMN "raw" jsonb;
  ALTER TABLE "stocks" ADD COLUMN "carbon_content" numeric;
  ALTER TABLE "stocks" ADD COLUMN "status" varchar;
  ALTER TABLE "stocks" ADD COLUMN "certificates" jsonb;
  ALTER TABLE "stocks" ADD COLUMN "raw" jsonb;
  ALTER TABLE "sinks" ADD COLUMN "reports" jsonb;
  ALTER TABLE "sinks" ADD COLUMN "raw" jsonb;
  ALTER TABLE "documents" ADD COLUMN "expires_at" timestamp(3) with time zone;
  ALTER TABLE "documents" ADD COLUMN "raw" jsonb;
  ALTER TABLE "files" ADD COLUMN "storage_path" varchar;
  ALTER TABLE "files" ADD COLUMN "source_path" varchar;
  ALTER TABLE "files" ADD COLUMN "category" varchar;
  ALTER TABLE "files" ADD COLUMN "owner_collection" varchar;
  ALTER TABLE "files" ADD COLUMN "owner_id" varchar;
  ALTER TABLE "files" ADD COLUMN "status" "enum_files_status" DEFAULT 'stored';
  ALTER TABLE "activity_logs" ADD COLUMN "action_type" varchar;
  ALTER TABLE "activity_logs" ADD COLUMN "at" timestamp(3) with time zone;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "containers_id" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "biomass_sources_id" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "inventories_id" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "applications_id" varchar;
  ALTER TABLE "company" ADD COLUMN "certificate_settings" jsonb;
  ALTER TABLE "company" ADD COLUMN "raw" jsonb;
  ALTER TABLE "containers" ADD CONSTRAINT "containers_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "containers" ADD CONSTRAINT "containers_network_id_networks_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."networks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "biomass_sources" ADD CONSTRAINT "biomass_sources_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "biomass_sources" ADD CONSTRAINT "biomass_sources_network_id_networks_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."networks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inventories" ADD CONSTRAINT "inventories_network_id_networks_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."networks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inventories" ADD CONSTRAINT "inventories_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inventories_rels" ADD CONSTRAINT "inventories_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."inventories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "inventories_rels" ADD CONSTRAINT "inventories_rels_batches_fk" FOREIGN KEY ("batches_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "applications" ADD CONSTRAINT "applications_network_id_networks_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."networks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "applications" ADD CONSTRAINT "applications_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "containers_kind_idx" ON "containers" USING btree ("kind");
  CREATE INDEX "containers_site_idx" ON "containers" USING btree ("site_id");
  CREATE INDEX "containers_network_idx" ON "containers" USING btree ("network_id");
  CREATE INDEX "containers_code_idx" ON "containers" USING btree ("code");
  CREATE INDEX "containers_updated_at_idx" ON "containers" USING btree ("updated_at");
  CREATE INDEX "containers_created_at_idx" ON "containers" USING btree ("created_at");
  CREATE INDEX "biomass_sources_site_idx" ON "biomass_sources" USING btree ("site_id");
  CREATE INDEX "biomass_sources_network_idx" ON "biomass_sources" USING btree ("network_id");
  CREATE INDEX "biomass_sources_updated_at_idx" ON "biomass_sources" USING btree ("updated_at");
  CREATE INDEX "biomass_sources_created_at_idx" ON "biomass_sources" USING btree ("created_at");
  CREATE INDEX "inventories_code_idx" ON "inventories" USING btree ("code");
  CREATE INDEX "inventories_network_idx" ON "inventories" USING btree ("network_id");
  CREATE INDEX "inventories_site_idx" ON "inventories" USING btree ("site_id");
  CREATE INDEX "inventories_packed_at_idx" ON "inventories" USING btree ("packed_at");
  CREATE INDEX "inventories_updated_at_idx" ON "inventories" USING btree ("updated_at");
  CREATE INDEX "inventories_created_at_idx" ON "inventories" USING btree ("created_at");
  CREATE INDEX "inventories_rels_order_idx" ON "inventories_rels" USING btree ("order");
  CREATE INDEX "inventories_rels_parent_idx" ON "inventories_rels" USING btree ("parent_id");
  CREATE INDEX "inventories_rels_path_idx" ON "inventories_rels" USING btree ("path");
  CREATE INDEX "inventories_rels_batches_id_idx" ON "inventories_rels" USING btree ("batches_id");
  CREATE INDEX "applications_date_idx" ON "applications" USING btree ("date");
  CREATE INDEX "applications_network_idx" ON "applications" USING btree ("network_id");
  CREATE INDEX "applications_site_idx" ON "applications" USING btree ("site_id");
  CREATE INDEX "applications_updated_at_idx" ON "applications" USING btree ("updated_at");
  CREATE INDEX "applications_created_at_idx" ON "applications" USING btree ("created_at");
  ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "batches" ADD CONSTRAINT "batches_sampling_container_id_containers_id_fk" FOREIGN KEY ("sampling_container_id") REFERENCES "public"."containers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "biomass_collections" ADD CONSTRAINT "biomass_collections_biomass_source_id_biomass_sources_id_fk" FOREIGN KEY ("biomass_source_id") REFERENCES "public"."biomass_sources"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_containers_fk" FOREIGN KEY ("containers_id") REFERENCES "public"."containers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_biomass_sources_fk" FOREIGN KEY ("biomass_sources_id") REFERENCES "public"."biomass_sources"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_inventories_fk" FOREIGN KEY ("inventories_id") REFERENCES "public"."inventories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_applications_fk" FOREIGN KEY ("applications_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "users_firebase_uid_idx" ON "users" USING btree ("firebase_uid");
  CREATE INDEX "vehicles_site_idx" ON "vehicles" USING btree ("site_id");
  CREATE INDEX "batches_sampling_container_idx" ON "batches" USING btree ("sampling_container_id");
  CREATE INDEX "biomass_collections_biomass_source_idx" ON "biomass_collections" USING btree ("biomass_source_id");
  CREATE INDEX "files_source_path_idx" ON "files" USING btree ("source_path");
  CREATE INDEX "files_category_idx" ON "files" USING btree ("category");
  CREATE INDEX "files_owner_collection_idx" ON "files" USING btree ("owner_collection");
  CREATE INDEX "files_owner_id_idx" ON "files" USING btree ("owner_id");
  CREATE INDEX "files_status_idx" ON "files" USING btree ("status");
  CREATE INDEX "activity_logs_at_idx" ON "activity_logs" USING btree ("at");
  CREATE INDEX "payload_locked_documents_rels_containers_id_idx" ON "payload_locked_documents_rels" USING btree ("containers_id");
  CREATE INDEX "payload_locked_documents_rels_biomass_sources_id_idx" ON "payload_locked_documents_rels" USING btree ("biomass_sources_id");
  CREATE INDEX "payload_locked_documents_rels_inventories_id_idx" ON "payload_locked_documents_rels" USING btree ("inventories_id");
  CREATE INDEX "payload_locked_documents_rels_applications_id_idx" ON "payload_locked_documents_rels" USING btree ("applications_id");
  ALTER TABLE "users" DROP COLUMN "username";
  ALTER TABLE "users" DROP COLUMN "reset_password_token";
  ALTER TABLE "users" DROP COLUMN "reset_password_expiration";
  ALTER TABLE "users" DROP COLUMN "salt";
  ALTER TABLE "users" DROP COLUMN "hash";
  ALTER TABLE "users" DROP COLUMN "reset_password_requested_at";
  ALTER TABLE "users" DROP COLUMN "login_attempts";
  ALTER TABLE "users" DROP COLUMN "lock_until";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  ALTER TABLE "containers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "biomass_sources" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "inventories" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "inventories_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "applications" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "containers" CASCADE;
  DROP TABLE "biomass_sources" CASCADE;
  DROP TABLE "inventories" CASCADE;
  DROP TABLE "inventories_rels" CASCADE;
  DROP TABLE "applications" CASCADE;
  ALTER TABLE "vehicles" DROP CONSTRAINT "vehicles_site_id_sites_id_fk";
  
  ALTER TABLE "batches" DROP CONSTRAINT "batches_sampling_container_id_containers_id_fk";
  
  ALTER TABLE "biomass_collections" DROP CONSTRAINT "biomass_collections_biomass_source_id_biomass_sources_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_containers_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_biomass_sources_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_inventories_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_applications_fk";
  
  DROP INDEX "users_firebase_uid_idx";
  DROP INDEX "vehicles_site_idx";
  DROP INDEX "batches_sampling_container_idx";
  DROP INDEX "biomass_collections_biomass_source_idx";
  DROP INDEX "files_source_path_idx";
  DROP INDEX "files_category_idx";
  DROP INDEX "files_owner_collection_idx";
  DROP INDEX "files_owner_id_idx";
  DROP INDEX "files_status_idx";
  DROP INDEX "activity_logs_at_idx";
  DROP INDEX "payload_locked_documents_rels_containers_id_idx";
  DROP INDEX "payload_locked_documents_rels_biomass_sources_id_idx";
  DROP INDEX "payload_locked_documents_rels_inventories_id_idx";
  DROP INDEX "payload_locked_documents_rels_applications_id_idx";
  ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
  ALTER TABLE "files" ALTER COLUMN "size" SET NOT NULL;
  ALTER TABLE "files" ALTER COLUMN "data" SET NOT NULL;
  ALTER TABLE "users" ADD COLUMN "username" varchar NOT NULL;
  ALTER TABLE "users" ADD COLUMN "reset_password_token" varchar;
  ALTER TABLE "users" ADD COLUMN "reset_password_expiration" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "salt" varchar;
  ALTER TABLE "users" ADD COLUMN "hash" varchar;
  ALTER TABLE "users" ADD COLUMN "reset_password_requested_at" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "login_attempts" numeric DEFAULT 0;
  ALTER TABLE "users" ADD COLUMN "lock_until" timestamp(3) with time zone;
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "users_username_idx" ON "users" USING btree ("username");
  ALTER TABLE "users" DROP COLUMN "firebase_uid";
  ALTER TABLE "users" DROP COLUMN "photo_url";
  ALTER TABLE "users" DROP COLUMN "disabled";
  ALTER TABLE "users" DROP COLUMN "last_sign_in_at";
  ALTER TABLE "organizations" DROP COLUMN "raw";
  ALTER TABLE "networks" DROP COLUMN "address";
  ALTER TABLE "networks" DROP COLUMN "country";
  ALTER TABLE "networks" DROP COLUMN "methane_strategy";
  ALTER TABLE "networks" DROP COLUMN "raw";
  ALTER TABLE "sites" DROP COLUMN "address";
  ALTER TABLE "sites" DROP COLUMN "kml";
  ALTER TABLE "sites" DROP COLUMN "raw";
  ALTER TABLE "kilns" DROP COLUMN "shape";
  ALTER TABLE "kilns" DROP COLUMN "dimensions";
  ALTER TABLE "kilns" DROP COLUMN "raw";
  ALTER TABLE "people" DROP COLUMN "address";
  ALTER TABLE "people" DROP COLUMN "raw";
  ALTER TABLE "vehicles" DROP COLUMN "site_id";
  ALTER TABLE "vehicles" DROP COLUMN "name";
  ALTER TABLE "vehicles" DROP COLUMN "type";
  ALTER TABLE "vehicles" DROP COLUMN "raw";
  ALTER TABLE "batches" DROP COLUMN "assessed_at";
  ALTER TABLE "batches" DROP COLUMN "temperature_c";
  ALTER TABLE "batches" DROP COLUMN "moisture_readings";
  ALTER TABLE "batches" DROP COLUMN "co2_emission_kg";
  ALTER TABLE "batches" DROP COLUMN "methane_emission_kg";
  ALTER TABLE "batches" DROP COLUMN "short_term_sink_t";
  ALTER TABLE "batches" DROP COLUMN "kiln_volume_l";
  ALTER TABLE "batches" DROP COLUMN "sampling_container_id";
  ALTER TABLE "batches" DROP COLUMN "raw";
  ALTER TABLE "biomass_collections" DROP COLUMN "biomass_source_id";
  ALTER TABLE "biomass_collections" DROP COLUMN "raw";
  ALTER TABLE "mixings" DROP COLUMN "raw";
  ALTER TABLE "packagings" DROP COLUMN "raw";
  ALTER TABLE "stocks" DROP COLUMN "carbon_content";
  ALTER TABLE "stocks" DROP COLUMN "status";
  ALTER TABLE "stocks" DROP COLUMN "certificates";
  ALTER TABLE "stocks" DROP COLUMN "raw";
  ALTER TABLE "sinks" DROP COLUMN "reports";
  ALTER TABLE "sinks" DROP COLUMN "raw";
  ALTER TABLE "documents" DROP COLUMN "expires_at";
  ALTER TABLE "documents" DROP COLUMN "raw";
  ALTER TABLE "files" DROP COLUMN "storage_path";
  ALTER TABLE "files" DROP COLUMN "source_path";
  ALTER TABLE "files" DROP COLUMN "category";
  ALTER TABLE "files" DROP COLUMN "owner_collection";
  ALTER TABLE "files" DROP COLUMN "owner_id";
  ALTER TABLE "files" DROP COLUMN "status";
  ALTER TABLE "activity_logs" DROP COLUMN "action_type";
  ALTER TABLE "activity_logs" DROP COLUMN "at";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "containers_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "biomass_sources_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "inventories_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "applications_id";
  ALTER TABLE "company" DROP COLUMN "certificate_settings";
  ALTER TABLE "company" DROP COLUMN "raw";
  DROP TYPE "public"."enum_containers_kind";
  DROP TYPE "public"."enum_files_status";`)
}
