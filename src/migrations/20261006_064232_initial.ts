import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'viewer');
  CREATE TYPE "public"."enum_networks_type" AS ENUM('artisan', 'csink');
  CREATE TYPE "public"."enum_kilns_type" AS ENUM('kontiki', 'pit');
  CREATE TYPE "public"."enum_people_role" AS ENUM('manager', 'supervisor', 'operator', 'farmer');
  CREATE TYPE "public"."enum_feedstocks_strategy" AS ENUM('methane', 'compensation', 'avoidance');
  CREATE TYPE "public"."enum_batches_status" AS ENUM('started', 'not_assessed', 'approved', 'admin_approved', 'rejected', 'admin_rejected');
  CREATE TYPE "public"."enum_biomass_collections_transport" AS ENUM('manual', 'vehicle');
  CREATE TYPE "public"."enum_sinks_status" AS ENUM('pending', 'approved', 'rejected');
  CREATE TYPE "public"."enum_documents_category" AS ENUM('csi-compliance', 'certificate', 'other');
  CREATE TYPE "public"."enum_templates_kind" AS ENUM('kiln', 'container');
  CREATE TYPE "public"."enum_templates_kiln_type" AS ENUM('kontiki', 'pit');
  CREATE TYPE "public"."enum_templates_unit" AS ENUM('mm', 'cm', 'm');
  CREATE TYPE "public"."enum_alerts_kind" AS ENUM('bulk-density', 'certificate', 'kiln');
  CREATE TYPE "public"."enum_alerts_status" AS ENUM('open', 'approved', 'rejected', 'dismissed');
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"role" "enum_users_role" DEFAULT 'admin' NOT NULL,
  	"phone" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar,
  	"username" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "organizations" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"code" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"country" varchar,
  	"address" varchar,
  	"active" boolean DEFAULT true,
  	"admins" jsonb DEFAULT '[]'::jsonb,
  	"standards" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "networks" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"organization_id" varchar NOT NULL,
  	"code" varchar,
  	"name" varchar NOT NULL,
  	"type" "enum_networks_type" DEFAULT 'artisan' NOT NULL,
  	"location" varchar,
  	"lat" numeric,
  	"lng" numeric,
  	"active" boolean DEFAULT true,
  	"ceres_approved" boolean DEFAULT false,
  	"certified_at" timestamp(3) with time zone,
  	"config" jsonb,
  	"kml" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "sites" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"network_id" varchar NOT NULL,
  	"code" varchar,
  	"name" varchar NOT NULL,
  	"lat" numeric,
  	"lng" numeric,
  	"active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "kilns" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"site_id" varchar NOT NULL,
  	"code" varchar,
  	"name" varchar NOT NULL,
  	"type" "enum_kilns_type" NOT NULL,
  	"volume_m3" numeric,
  	"lat" numeric,
  	"lng" numeric,
  	"active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "people" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"role" "enum_people_role" NOT NULL,
  	"email" varchar,
  	"phone" varchar,
  	"organization_id" varchar,
  	"active" boolean DEFAULT true,
  	"otp_bypass" boolean DEFAULT false,
  	"photo" varchar,
  	"training_docs" jsonb DEFAULT '[]'::jsonb,
  	"device" jsonb,
  	"lat" numeric,
  	"lng" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "people_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" varchar NOT NULL,
  	"path" varchar NOT NULL,
  	"networks_id" varchar,
  	"sites_id" varchar
  );
  
  CREATE TABLE "vehicles" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"network_id" varchar,
  	"plate" varchar NOT NULL,
  	"fuel" varchar,
  	"emission_factor" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "feedstocks" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"strategy" "enum_feedstocks_strategy",
  	"spc" boolean DEFAULT false,
  	"carbon_content" numeric,
  	"bulk_density" numeric,
  	"volume_tracking" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "batches" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"code" varchar NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"network_id" varchar NOT NULL,
  	"site_id" varchar NOT NULL,
  	"kiln_id" varchar,
  	"start_date" timestamp(3) with time zone,
  	"ended_at" timestamp(3) with time zone,
  	"feedstock" varchar,
  	"biomass_kg" numeric,
  	"biochar_l" numeric,
  	"bulk_density" numeric,
  	"carbon_content" numeric,
  	"csink_t" numeric,
  	"operator_id" varchar,
  	"operator_name" varchar,
  	"status" "enum_batches_status" DEFAULT 'not_assessed' NOT NULL,
  	"assessed_by" varchar,
  	"assessor_email" varchar,
  	"sink_approved" boolean DEFAULT false,
  	"registered" boolean DEFAULT false,
  	"rejection_reason" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "biomass_collections" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"network_id" varchar NOT NULL,
  	"site_id" varchar NOT NULL,
  	"farmer_id" varchar,
  	"feedstock" varchar,
  	"source" varchar,
  	"quantity_kg" numeric,
  	"transport" "enum_biomass_collections_transport" DEFAULT 'manual',
  	"vehicle_id" varchar,
  	"vehicle_details" varchar,
  	"emission_factor" numeric,
  	"distance_km" numeric,
  	"emissions" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "mixings" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"network_id" varchar NOT NULL,
  	"site_id" varchar NOT NULL,
  	"mixing_type" varchar,
  	"biochar_l" numeric,
  	"other_material_kg" numeric,
  	"total_kg" numeric,
  	"bag_details" varchar,
  	"bags_created" numeric,
  	"bags_available" numeric,
  	"description" varchar,
  	"rejected_biochar_l" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "mixings_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" varchar NOT NULL,
  	"path" varchar NOT NULL,
  	"batches_id" varchar
  );
  
  CREATE TABLE "packagings" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"network_id" varchar NOT NULL,
  	"site_id" varchar NOT NULL,
  	"packaging_type" varchar,
  	"biochar_kg" numeric,
  	"mix_kg" numeric,
  	"bag_details" varchar,
  	"bags_created" numeric,
  	"bags_distributed" numeric,
  	"bags_remaining" numeric,
  	"description" varchar,
  	"rejected_biochar_l" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "packagings_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" varchar NOT NULL,
  	"path" varchar NOT NULL,
  	"batches_id" varchar
  );
  
  CREATE TABLE "stocks" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"stock_id" varchar NOT NULL,
  	"code" varchar,
  	"network_id" varchar,
  	"feedstock" varchar,
  	"biochar_t" numeric,
  	"credits_t" numeric,
  	"produced_at" timestamp(3) with time zone,
  	"generated_at" timestamp(3) with time zone,
  	"partial" boolean DEFAULT false,
  	"deleted" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "sinks" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"sink_id" varchar NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"stock_id" varchar,
  	"biochar_t" numeric,
  	"matrix_id" varchar,
  	"status" "enum_sinks_status" DEFAULT 'pending' NOT NULL,
  	"deleted" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "documents" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"category" "enum_documents_category" DEFAULT 'csi-compliance' NOT NULL,
  	"reference" varchar,
  	"issued_at" timestamp(3) with time zone,
  	"file_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "templates" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"kind" "enum_templates_kind" NOT NULL,
  	"name" varchar NOT NULL,
  	"kiln_type" "enum_templates_kiln_type",
  	"shape" varchar NOT NULL,
  	"unit" "enum_templates_unit" DEFAULT 'cm',
  	"dimensions" jsonb NOT NULL,
  	"volume_l" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "files" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"mime_type" varchar NOT NULL,
  	"size" numeric NOT NULL,
  	"data" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "alerts" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"kind" "enum_alerts_kind" NOT NULL,
  	"message" varchar NOT NULL,
  	"network_id" varchar,
  	"request" jsonb,
  	"status" "enum_alerts_status" DEFAULT 'open',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "activity_logs" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"message" varchar NOT NULL,
  	"network_id" varchar,
  	"by" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"organizations_id" varchar,
  	"networks_id" varchar,
  	"sites_id" varchar,
  	"kilns_id" varchar,
  	"people_id" varchar,
  	"vehicles_id" varchar,
  	"feedstocks_id" varchar,
  	"batches_id" varchar,
  	"biomass_collections_id" varchar,
  	"mixings_id" varchar,
  	"packagings_id" varchar,
  	"stocks_id" varchar,
  	"sinks_id" varchar,
  	"documents_id" varchar,
  	"templates_id" varchar,
  	"files_id" varchar,
  	"alerts_id" varchar,
  	"activity_logs_id" varchar
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "company" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar DEFAULT 'Reclimate Pte Ltd' NOT NULL,
  	"kind" varchar DEFAULT 'C-sink manager',
  	"address" varchar,
  	"email" varchar,
  	"phone" varchar,
  	"dmrv_provider" varchar,
  	"profile" jsonb,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "networks" ADD CONSTRAINT "networks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sites" ADD CONSTRAINT "sites_network_id_networks_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."networks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "kilns" ADD CONSTRAINT "kilns_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "people" ADD CONSTRAINT "people_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "people_rels" ADD CONSTRAINT "people_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "people_rels" ADD CONSTRAINT "people_rels_networks_fk" FOREIGN KEY ("networks_id") REFERENCES "public"."networks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "people_rels" ADD CONSTRAINT "people_rels_sites_fk" FOREIGN KEY ("sites_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_network_id_networks_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."networks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "batches" ADD CONSTRAINT "batches_network_id_networks_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."networks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "batches" ADD CONSTRAINT "batches_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "batches" ADD CONSTRAINT "batches_kiln_id_kilns_id_fk" FOREIGN KEY ("kiln_id") REFERENCES "public"."kilns"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "batches" ADD CONSTRAINT "batches_operator_id_people_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "biomass_collections" ADD CONSTRAINT "biomass_collections_network_id_networks_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."networks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "biomass_collections" ADD CONSTRAINT "biomass_collections_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "biomass_collections" ADD CONSTRAINT "biomass_collections_farmer_id_people_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "biomass_collections" ADD CONSTRAINT "biomass_collections_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "mixings" ADD CONSTRAINT "mixings_network_id_networks_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."networks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "mixings" ADD CONSTRAINT "mixings_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "mixings_rels" ADD CONSTRAINT "mixings_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."mixings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "mixings_rels" ADD CONSTRAINT "mixings_rels_batches_fk" FOREIGN KEY ("batches_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "packagings" ADD CONSTRAINT "packagings_network_id_networks_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."networks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "packagings" ADD CONSTRAINT "packagings_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "packagings_rels" ADD CONSTRAINT "packagings_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."packagings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "packagings_rels" ADD CONSTRAINT "packagings_rels_batches_fk" FOREIGN KEY ("batches_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "stocks" ADD CONSTRAINT "stocks_network_id_networks_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."networks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sinks" ADD CONSTRAINT "sinks_stock_id_stocks_id_fk" FOREIGN KEY ("stock_id") REFERENCES "public"."stocks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "documents" ADD CONSTRAINT "documents_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "alerts" ADD CONSTRAINT "alerts_network_id_networks_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."networks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_network_id_networks_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."networks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_organizations_fk" FOREIGN KEY ("organizations_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_networks_fk" FOREIGN KEY ("networks_id") REFERENCES "public"."networks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_sites_fk" FOREIGN KEY ("sites_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_kilns_fk" FOREIGN KEY ("kilns_id") REFERENCES "public"."kilns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_people_fk" FOREIGN KEY ("people_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_vehicles_fk" FOREIGN KEY ("vehicles_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_feedstocks_fk" FOREIGN KEY ("feedstocks_id") REFERENCES "public"."feedstocks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_batches_fk" FOREIGN KEY ("batches_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_biomass_collections_fk" FOREIGN KEY ("biomass_collections_id") REFERENCES "public"."biomass_collections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_mixings_fk" FOREIGN KEY ("mixings_id") REFERENCES "public"."mixings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_packagings_fk" FOREIGN KEY ("packagings_id") REFERENCES "public"."packagings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_stocks_fk" FOREIGN KEY ("stocks_id") REFERENCES "public"."stocks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_sinks_fk" FOREIGN KEY ("sinks_id") REFERENCES "public"."sinks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_documents_fk" FOREIGN KEY ("documents_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_templates_fk" FOREIGN KEY ("templates_id") REFERENCES "public"."templates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_files_fk" FOREIGN KEY ("files_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_alerts_fk" FOREIGN KEY ("alerts_id") REFERENCES "public"."alerts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_activity_logs_fk" FOREIGN KEY ("activity_logs_id") REFERENCES "public"."activity_logs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE UNIQUE INDEX "users_username_idx" ON "users" USING btree ("username");
  CREATE UNIQUE INDEX "organizations_code_idx" ON "organizations" USING btree ("code");
  CREATE INDEX "organizations_updated_at_idx" ON "organizations" USING btree ("updated_at");
  CREATE INDEX "organizations_created_at_idx" ON "organizations" USING btree ("created_at");
  CREATE INDEX "networks_organization_idx" ON "networks" USING btree ("organization_id");
  CREATE INDEX "networks_code_idx" ON "networks" USING btree ("code");
  CREATE INDEX "networks_updated_at_idx" ON "networks" USING btree ("updated_at");
  CREATE INDEX "networks_created_at_idx" ON "networks" USING btree ("created_at");
  CREATE INDEX "sites_network_idx" ON "sites" USING btree ("network_id");
  CREATE INDEX "sites_updated_at_idx" ON "sites" USING btree ("updated_at");
  CREATE INDEX "sites_created_at_idx" ON "sites" USING btree ("created_at");
  CREATE INDEX "kilns_site_idx" ON "kilns" USING btree ("site_id");
  CREATE INDEX "kilns_updated_at_idx" ON "kilns" USING btree ("updated_at");
  CREATE INDEX "kilns_created_at_idx" ON "kilns" USING btree ("created_at");
  CREATE INDEX "people_name_idx" ON "people" USING btree ("name");
  CREATE INDEX "people_organization_idx" ON "people" USING btree ("organization_id");
  CREATE INDEX "people_updated_at_idx" ON "people" USING btree ("updated_at");
  CREATE INDEX "people_created_at_idx" ON "people" USING btree ("created_at");
  CREATE INDEX "people_rels_order_idx" ON "people_rels" USING btree ("order");
  CREATE INDEX "people_rels_parent_idx" ON "people_rels" USING btree ("parent_id");
  CREATE INDEX "people_rels_path_idx" ON "people_rels" USING btree ("path");
  CREATE INDEX "people_rels_networks_id_idx" ON "people_rels" USING btree ("networks_id");
  CREATE INDEX "people_rels_sites_id_idx" ON "people_rels" USING btree ("sites_id");
  CREATE INDEX "vehicles_network_idx" ON "vehicles" USING btree ("network_id");
  CREATE INDEX "vehicles_updated_at_idx" ON "vehicles" USING btree ("updated_at");
  CREATE INDEX "vehicles_created_at_idx" ON "vehicles" USING btree ("created_at");
  CREATE UNIQUE INDEX "feedstocks_name_idx" ON "feedstocks" USING btree ("name");
  CREATE INDEX "feedstocks_updated_at_idx" ON "feedstocks" USING btree ("updated_at");
  CREATE INDEX "feedstocks_created_at_idx" ON "feedstocks" USING btree ("created_at");
  CREATE UNIQUE INDEX "batches_code_idx" ON "batches" USING btree ("code");
  CREATE INDEX "batches_date_idx" ON "batches" USING btree ("date");
  CREATE INDEX "batches_network_idx" ON "batches" USING btree ("network_id");
  CREATE INDEX "batches_site_idx" ON "batches" USING btree ("site_id");
  CREATE INDEX "batches_kiln_idx" ON "batches" USING btree ("kiln_id");
  CREATE INDEX "batches_feedstock_idx" ON "batches" USING btree ("feedstock");
  CREATE INDEX "batches_operator_idx" ON "batches" USING btree ("operator_id");
  CREATE INDEX "batches_status_idx" ON "batches" USING btree ("status");
  CREATE INDEX "batches_sink_approved_idx" ON "batches" USING btree ("sink_approved");
  CREATE INDEX "batches_registered_idx" ON "batches" USING btree ("registered");
  CREATE INDEX "batches_updated_at_idx" ON "batches" USING btree ("updated_at");
  CREATE INDEX "batches_created_at_idx" ON "batches" USING btree ("created_at");
  CREATE INDEX "biomass_collections_date_idx" ON "biomass_collections" USING btree ("date");
  CREATE INDEX "biomass_collections_network_idx" ON "biomass_collections" USING btree ("network_id");
  CREATE INDEX "biomass_collections_site_idx" ON "biomass_collections" USING btree ("site_id");
  CREATE INDEX "biomass_collections_farmer_idx" ON "biomass_collections" USING btree ("farmer_id");
  CREATE INDEX "biomass_collections_vehicle_idx" ON "biomass_collections" USING btree ("vehicle_id");
  CREATE INDEX "biomass_collections_updated_at_idx" ON "biomass_collections" USING btree ("updated_at");
  CREATE INDEX "biomass_collections_created_at_idx" ON "biomass_collections" USING btree ("created_at");
  CREATE INDEX "mixings_date_idx" ON "mixings" USING btree ("date");
  CREATE INDEX "mixings_network_idx" ON "mixings" USING btree ("network_id");
  CREATE INDEX "mixings_site_idx" ON "mixings" USING btree ("site_id");
  CREATE INDEX "mixings_updated_at_idx" ON "mixings" USING btree ("updated_at");
  CREATE INDEX "mixings_created_at_idx" ON "mixings" USING btree ("created_at");
  CREATE INDEX "mixings_rels_order_idx" ON "mixings_rels" USING btree ("order");
  CREATE INDEX "mixings_rels_parent_idx" ON "mixings_rels" USING btree ("parent_id");
  CREATE INDEX "mixings_rels_path_idx" ON "mixings_rels" USING btree ("path");
  CREATE INDEX "mixings_rels_batches_id_idx" ON "mixings_rels" USING btree ("batches_id");
  CREATE INDEX "packagings_date_idx" ON "packagings" USING btree ("date");
  CREATE INDEX "packagings_network_idx" ON "packagings" USING btree ("network_id");
  CREATE INDEX "packagings_site_idx" ON "packagings" USING btree ("site_id");
  CREATE INDEX "packagings_updated_at_idx" ON "packagings" USING btree ("updated_at");
  CREATE INDEX "packagings_created_at_idx" ON "packagings" USING btree ("created_at");
  CREATE INDEX "packagings_rels_order_idx" ON "packagings_rels" USING btree ("order");
  CREATE INDEX "packagings_rels_parent_idx" ON "packagings_rels" USING btree ("parent_id");
  CREATE INDEX "packagings_rels_path_idx" ON "packagings_rels" USING btree ("path");
  CREATE INDEX "packagings_rels_batches_id_idx" ON "packagings_rels" USING btree ("batches_id");
  CREATE UNIQUE INDEX "stocks_stock_id_idx" ON "stocks" USING btree ("stock_id");
  CREATE INDEX "stocks_network_idx" ON "stocks" USING btree ("network_id");
  CREATE INDEX "stocks_generated_at_idx" ON "stocks" USING btree ("generated_at");
  CREATE INDEX "stocks_deleted_idx" ON "stocks" USING btree ("deleted");
  CREATE INDEX "stocks_updated_at_idx" ON "stocks" USING btree ("updated_at");
  CREATE INDEX "stocks_created_at_idx" ON "stocks" USING btree ("created_at");
  CREATE UNIQUE INDEX "sinks_sink_id_idx" ON "sinks" USING btree ("sink_id");
  CREATE INDEX "sinks_date_idx" ON "sinks" USING btree ("date");
  CREATE INDEX "sinks_stock_idx" ON "sinks" USING btree ("stock_id");
  CREATE INDEX "sinks_deleted_idx" ON "sinks" USING btree ("deleted");
  CREATE INDEX "sinks_updated_at_idx" ON "sinks" USING btree ("updated_at");
  CREATE INDEX "sinks_created_at_idx" ON "sinks" USING btree ("created_at");
  CREATE INDEX "documents_file_idx" ON "documents" USING btree ("file_id");
  CREATE INDEX "documents_updated_at_idx" ON "documents" USING btree ("updated_at");
  CREATE INDEX "documents_created_at_idx" ON "documents" USING btree ("created_at");
  CREATE INDEX "templates_kind_idx" ON "templates" USING btree ("kind");
  CREATE INDEX "templates_updated_at_idx" ON "templates" USING btree ("updated_at");
  CREATE INDEX "templates_created_at_idx" ON "templates" USING btree ("created_at");
  CREATE INDEX "files_updated_at_idx" ON "files" USING btree ("updated_at");
  CREATE INDEX "files_created_at_idx" ON "files" USING btree ("created_at");
  CREATE INDEX "alerts_network_idx" ON "alerts" USING btree ("network_id");
  CREATE INDEX "alerts_status_idx" ON "alerts" USING btree ("status");
  CREATE INDEX "alerts_updated_at_idx" ON "alerts" USING btree ("updated_at");
  CREATE INDEX "alerts_created_at_idx" ON "alerts" USING btree ("created_at");
  CREATE INDEX "activity_logs_network_idx" ON "activity_logs" USING btree ("network_id");
  CREATE INDEX "activity_logs_updated_at_idx" ON "activity_logs" USING btree ("updated_at");
  CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_organizations_id_idx" ON "payload_locked_documents_rels" USING btree ("organizations_id");
  CREATE INDEX "payload_locked_documents_rels_networks_id_idx" ON "payload_locked_documents_rels" USING btree ("networks_id");
  CREATE INDEX "payload_locked_documents_rels_sites_id_idx" ON "payload_locked_documents_rels" USING btree ("sites_id");
  CREATE INDEX "payload_locked_documents_rels_kilns_id_idx" ON "payload_locked_documents_rels" USING btree ("kilns_id");
  CREATE INDEX "payload_locked_documents_rels_people_id_idx" ON "payload_locked_documents_rels" USING btree ("people_id");
  CREATE INDEX "payload_locked_documents_rels_vehicles_id_idx" ON "payload_locked_documents_rels" USING btree ("vehicles_id");
  CREATE INDEX "payload_locked_documents_rels_feedstocks_id_idx" ON "payload_locked_documents_rels" USING btree ("feedstocks_id");
  CREATE INDEX "payload_locked_documents_rels_batches_id_idx" ON "payload_locked_documents_rels" USING btree ("batches_id");
  CREATE INDEX "payload_locked_documents_rels_biomass_collections_id_idx" ON "payload_locked_documents_rels" USING btree ("biomass_collections_id");
  CREATE INDEX "payload_locked_documents_rels_mixings_id_idx" ON "payload_locked_documents_rels" USING btree ("mixings_id");
  CREATE INDEX "payload_locked_documents_rels_packagings_id_idx" ON "payload_locked_documents_rels" USING btree ("packagings_id");
  CREATE INDEX "payload_locked_documents_rels_stocks_id_idx" ON "payload_locked_documents_rels" USING btree ("stocks_id");
  CREATE INDEX "payload_locked_documents_rels_sinks_id_idx" ON "payload_locked_documents_rels" USING btree ("sinks_id");
  CREATE INDEX "payload_locked_documents_rels_documents_id_idx" ON "payload_locked_documents_rels" USING btree ("documents_id");
  CREATE INDEX "payload_locked_documents_rels_templates_id_idx" ON "payload_locked_documents_rels" USING btree ("templates_id");
  CREATE INDEX "payload_locked_documents_rels_files_id_idx" ON "payload_locked_documents_rels" USING btree ("files_id");
  CREATE INDEX "payload_locked_documents_rels_alerts_id_idx" ON "payload_locked_documents_rels" USING btree ("alerts_id");
  CREATE INDEX "payload_locked_documents_rels_activity_logs_id_idx" ON "payload_locked_documents_rels" USING btree ("activity_logs_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "organizations" CASCADE;
  DROP TABLE "networks" CASCADE;
  DROP TABLE "sites" CASCADE;
  DROP TABLE "kilns" CASCADE;
  DROP TABLE "people" CASCADE;
  DROP TABLE "people_rels" CASCADE;
  DROP TABLE "vehicles" CASCADE;
  DROP TABLE "feedstocks" CASCADE;
  DROP TABLE "batches" CASCADE;
  DROP TABLE "biomass_collections" CASCADE;
  DROP TABLE "mixings" CASCADE;
  DROP TABLE "mixings_rels" CASCADE;
  DROP TABLE "packagings" CASCADE;
  DROP TABLE "packagings_rels" CASCADE;
  DROP TABLE "stocks" CASCADE;
  DROP TABLE "sinks" CASCADE;
  DROP TABLE "documents" CASCADE;
  DROP TABLE "templates" CASCADE;
  DROP TABLE "files" CASCADE;
  DROP TABLE "alerts" CASCADE;
  DROP TABLE "activity_logs" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "company" CASCADE;
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_networks_type";
  DROP TYPE "public"."enum_kilns_type";
  DROP TYPE "public"."enum_people_role";
  DROP TYPE "public"."enum_feedstocks_strategy";
  DROP TYPE "public"."enum_batches_status";
  DROP TYPE "public"."enum_biomass_collections_transport";
  DROP TYPE "public"."enum_sinks_status";
  DROP TYPE "public"."enum_documents_category";
  DROP TYPE "public"."enum_templates_kind";
  DROP TYPE "public"."enum_templates_kiln_type";
  DROP TYPE "public"."enum_templates_unit";
  DROP TYPE "public"."enum_alerts_kind";
  DROP TYPE "public"."enum_alerts_status";`)
}
