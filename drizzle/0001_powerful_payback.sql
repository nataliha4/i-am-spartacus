CREATE TABLE "request_buckets" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tracking_checklists" DROP CONSTRAINT "tracking_checklists_pkey";--> statement-breakpoint
ALTER TABLE "tracking_entries" DROP CONSTRAINT "tracking_entries_pkey";--> statement-breakpoint
ALTER TABLE "tracking_fasts" DROP CONSTRAINT "tracking_fasts_pkey";--> statement-breakpoint
ALTER TABLE "tracking_schedules" DROP CONSTRAINT "tracking_schedules_pkey";--> statement-breakpoint
ALTER TABLE "tracking_settings" DROP CONSTRAINT "tracking_settings_pkey";--> statement-breakpoint
ALTER TABLE "tracking_checklists" ADD CONSTRAINT "tracking_checklists_user_id_id_pk" PRIMARY KEY("user_id","id");--> statement-breakpoint
ALTER TABLE "tracking_entries" ADD CONSTRAINT "tracking_entries_user_id_id_pk" PRIMARY KEY("user_id","id");--> statement-breakpoint
ALTER TABLE "tracking_fasts" ADD CONSTRAINT "tracking_fasts_user_id_id_pk" PRIMARY KEY("user_id","id");--> statement-breakpoint
ALTER TABLE "tracking_schedules" ADD CONSTRAINT "tracking_schedules_user_id_id_pk" PRIMARY KEY("user_id","id");--> statement-breakpoint
ALTER TABLE "tracking_settings" ADD CONSTRAINT "tracking_settings_user_id_id_pk" PRIMARY KEY("user_id","id");--> statement-breakpoint
CREATE INDEX "request_buckets_expiry_idx" ON "request_buckets" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "auth_rate_limit_last_request_idx" ON "auth_rate_limit" USING btree ("last_request");--> statement-breakpoint
CREATE INDEX "mutation_receipts_created_idx" ON "mutation_receipts" USING btree ("created_at");