import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_sell_requests_status" AS ENUM('pending', 'paid', 'declined');
  CREATE TYPE "public"."enum_site_lists_category" AS ENUM('bags', 'crops', 'buyers');
  CREATE TABLE "sell_requests" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"person_id" varchar NOT NULL,
  	"network_id" varchar,
  	"site_id" varchar,
  	"credits_t" numeric NOT NULL,
  	"buyer" varchar,
  	"status" "enum_sell_requests_status" DEFAULT 'pending' NOT NULL,
  	"note" varchar,
  	"decided_by" varchar,
  	"decided_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "site_lists" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"site_id" varchar NOT NULL,
  	"category" "enum_site_lists_category" NOT NULL,
  	"name" varchar NOT NULL,
  	"detail" varchar,
  	"created_by_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "people" ADD COLUMN "app_access" boolean DEFAULT false;
  ALTER TABLE "people" ADD COLUMN "firebase_uid" varchar;
  ALTER TABLE "people" ADD COLUMN "must_change_password" boolean DEFAULT false;
  ALTER TABLE "people" ADD COLUMN "last_app_sign_in_at" timestamp(3) with time zone;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "sell_requests_id" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "site_lists_id" varchar;
  ALTER TABLE "sell_requests" ADD CONSTRAINT "sell_requests_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sell_requests" ADD CONSTRAINT "sell_requests_network_id_networks_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."networks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sell_requests" ADD CONSTRAINT "sell_requests_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_lists" ADD CONSTRAINT "site_lists_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_lists" ADD CONSTRAINT "site_lists_created_by_id_people_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "sell_requests_person_idx" ON "sell_requests" USING btree ("person_id");
  CREATE INDEX "sell_requests_network_idx" ON "sell_requests" USING btree ("network_id");
  CREATE INDEX "sell_requests_site_idx" ON "sell_requests" USING btree ("site_id");
  CREATE INDEX "sell_requests_status_idx" ON "sell_requests" USING btree ("status");
  CREATE INDEX "sell_requests_updated_at_idx" ON "sell_requests" USING btree ("updated_at");
  CREATE INDEX "sell_requests_created_at_idx" ON "sell_requests" USING btree ("created_at");
  CREATE INDEX "site_lists_site_idx" ON "site_lists" USING btree ("site_id");
  CREATE INDEX "site_lists_category_idx" ON "site_lists" USING btree ("category");
  CREATE INDEX "site_lists_created_by_idx" ON "site_lists" USING btree ("created_by_id");
  CREATE INDEX "site_lists_updated_at_idx" ON "site_lists" USING btree ("updated_at");
  CREATE INDEX "site_lists_created_at_idx" ON "site_lists" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_sell_requests_fk" FOREIGN KEY ("sell_requests_id") REFERENCES "public"."sell_requests"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_site_lists_fk" FOREIGN KEY ("site_lists_id") REFERENCES "public"."site_lists"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "people_firebase_uid_idx" ON "people" USING btree ("firebase_uid");
  CREATE INDEX "payload_locked_documents_rels_sell_requests_id_idx" ON "payload_locked_documents_rels" USING btree ("sell_requests_id");
  CREATE INDEX "payload_locked_documents_rels_site_lists_id_idx" ON "payload_locked_documents_rels" USING btree ("site_lists_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "sell_requests" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_lists" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "sell_requests" CASCADE;
  DROP TABLE "site_lists" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_sell_requests_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_site_lists_fk";
  
  DROP INDEX "people_firebase_uid_idx";
  DROP INDEX "payload_locked_documents_rels_sell_requests_id_idx";
  DROP INDEX "payload_locked_documents_rels_site_lists_id_idx";
  ALTER TABLE "people" DROP COLUMN "app_access";
  ALTER TABLE "people" DROP COLUMN "firebase_uid";
  ALTER TABLE "people" DROP COLUMN "must_change_password";
  ALTER TABLE "people" DROP COLUMN "last_app_sign_in_at";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "sell_requests_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "site_lists_id";
  DROP TYPE "public"."enum_sell_requests_status";
  DROP TYPE "public"."enum_site_lists_category";`)
}
