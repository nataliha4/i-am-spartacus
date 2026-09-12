CREATE TABLE "auth_account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracking_checklists" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" date,
	"category" text,
	"data" jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracking_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" date,
	"category" text,
	"data" jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entry_date_required" CHECK ("tracking_entries"."date" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "tracking_fasts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" date,
	"category" text,
	"data" jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_imports" (
	"user_id" text PRIMARY KEY NOT NULL,
	"fingerprint" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "auth_rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "mutation_receipts" (
	"user_id" text NOT NULL,
	"key" uuid NOT NULL,
	"hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mutation_receipts_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
CREATE TABLE "tracking_schedules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" date,
	"category" text,
	"data" jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	CONSTRAINT "auth_session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "tracking_settings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" date,
	"category" text,
	"data" jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"role" text DEFAULT 'user',
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	CONSTRAINT "auth_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auth_verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_account" ADD CONSTRAINT "auth_account_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_checklists" ADD CONSTRAINT "tracking_checklists_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_entries" ADD CONSTRAINT "tracking_entries_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_fasts" ADD CONSTRAINT "tracking_fasts_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_imports" ADD CONSTRAINT "data_imports_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mutation_receipts" ADD CONSTRAINT "mutation_receipts_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_schedules" ADD CONSTRAINT "tracking_schedules_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_session" ADD CONSTRAINT "auth_session_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_settings" ADD CONSTRAINT "tracking_settings_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_unique" ON "auth_account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "auth_account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "checklist_user_date_key" ON "tracking_checklists" USING btree ("user_id","date",("data"->>'key'));--> statement-breakpoint
CREATE INDEX "entries_user_date_idx" ON "tracking_entries" USING btree ("user_id","date","category");--> statement-breakpoint
CREATE INDEX "fasts_user_date_idx" ON "tracking_fasts" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "one_active_fast_per_user" ON "tracking_fasts" USING btree ("user_id") WHERE "tracking_fasts"."data"->>'endTimestampMs' IS NULL;--> statement-breakpoint
CREATE INDEX "schedules_user_idx" ON "tracking_schedules" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "auth_session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "settings_user_unique" ON "tracking_settings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "auth_verification" USING btree ("identifier");