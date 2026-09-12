CREATE TABLE "registration_capacity" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"max_users" integer DEFAULT 100 NOT NULL,
	"registered_users" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "registration_singleton" CHECK ("registration_capacity"."id" = 1),
	CONSTRAINT "registration_valid" CHECK ("registration_capacity"."max_users" >= 0 AND "registration_capacity"."registered_users" >= 0)
);
--> statement-breakpoint
CREATE TABLE "tracker_usage" (
	"user_id" text PRIMARY KEY NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"data_bytes" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tracker_usage" ADD CONSTRAINT "tracker_usage_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "verification_expiry_idx" ON "auth_verification" USING btree ("expires_at");--> statement-breakpoint
-- Freeze writes while seeding counters and installing their triggers. Existing
-- app instances must not create a gap between the snapshot and trigger activation.
LOCK TABLE auth_user, tracking_entries, tracking_schedules, tracking_checklists,
  tracking_settings, tracking_fasts IN SHARE ROW EXCLUSIVE MODE;
--> statement-breakpoint
-- Seed existing installations without discarding data or silently raising capacity.
INSERT INTO registration_capacity (id, registered_users)
SELECT 1, count(*) FROM auth_user;
--> statement-breakpoint
INSERT INTO tracker_usage (user_id, row_count, data_bytes)
SELECT u.id, count(r.user_id), coalesce(sum(octet_length(r.data::text)), 0)
FROM auth_user u LEFT JOIN (
  SELECT user_id, data FROM tracking_entries UNION ALL
  SELECT user_id, data FROM tracking_schedules UNION ALL
  SELECT user_id, data FROM tracking_checklists UNION ALL
  SELECT user_id, data FROM tracking_settings UNION ALL
  SELECT user_id, data FROM tracking_fasts
) r ON r.user_id = u.id GROUP BY u.id;
--> statement-breakpoint
CREATE FUNCTION maintain_registration_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE registration_capacity SET registered_users = registered_users + 1
      WHERE id = 1 AND registered_users < max_users;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Registration capacity reached'
        USING ERRCODE = '23514', CONSTRAINT = 'registration_capacity_limit';
    END IF;
    INSERT INTO tracker_usage (user_id) VALUES (NEW.id);
  ELSE
    UPDATE registration_capacity SET registered_users = registered_users - 1 WHERE id = 1;
  END IF;
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE TRIGGER registration_capacity_count AFTER INSERT OR DELETE ON auth_user
FOR EACH ROW EXECUTE FUNCTION maintain_registration_capacity();
--> statement-breakpoint
-- Statement transition tables account for bulk imports/deletions once per user,
-- avoiding thousands of updates to the same counter inside a transaction.
CREATE FUNCTION maintain_tracker_usage() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  delta record;
  source_query text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    source_query := 'SELECT user_id, count(*) AS rows_delta, sum(octet_length(data::text)) AS bytes_delta FROM new_rows GROUP BY user_id ORDER BY user_id';
  ELSIF TG_OP = 'DELETE' THEN
    source_query := 'SELECT user_id, -count(*) AS rows_delta, -sum(octet_length(data::text)) AS bytes_delta FROM old_rows GROUP BY user_id ORDER BY user_id';
  ELSE
    source_query := 'SELECT user_id, sum(rows_delta) AS rows_delta, sum(bytes_delta) AS bytes_delta FROM (
      SELECT user_id, 1 AS rows_delta, octet_length(data::text) AS bytes_delta FROM new_rows UNION ALL
      SELECT user_id, -1, -octet_length(data::text) FROM old_rows
    ) changes GROUP BY user_id ORDER BY user_id';
  END IF;
  FOR delta IN EXECUTE source_query LOOP
    UPDATE tracker_usage SET row_count = row_count + delta.rows_delta, data_bytes = data_bytes + delta.bytes_delta
      WHERE user_id = delta.user_id
        AND (delta.rows_delta <= 0 OR row_count + delta.rows_delta <= 50000)
        AND (delta.bytes_delta <= 0 OR data_bytes + delta.bytes_delta <= 5242880);
    -- Cascading account deletion may already have removed its usage row.
    IF NOT FOUND AND (delta.rows_delta > 0 OR delta.bytes_delta > 0) THEN
      RAISE EXCEPTION 'Tracker storage quota exceeded'
        USING ERRCODE = '23514', CONSTRAINT = 'tracker_storage_limit';
    END IF;
  END LOOP;
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE TRIGGER entries_usage_insert AFTER INSERT ON tracking_entries
REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION maintain_tracker_usage();
--> statement-breakpoint
CREATE TRIGGER entries_usage_update AFTER UPDATE ON tracking_entries
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION maintain_tracker_usage();
--> statement-breakpoint
CREATE TRIGGER entries_usage_delete AFTER DELETE ON tracking_entries
REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION maintain_tracker_usage();
--> statement-breakpoint
CREATE TRIGGER schedules_usage_insert AFTER INSERT ON tracking_schedules
REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION maintain_tracker_usage();
--> statement-breakpoint
CREATE TRIGGER schedules_usage_update AFTER UPDATE ON tracking_schedules
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION maintain_tracker_usage();
--> statement-breakpoint
CREATE TRIGGER schedules_usage_delete AFTER DELETE ON tracking_schedules
REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION maintain_tracker_usage();
--> statement-breakpoint
CREATE TRIGGER checklists_usage_insert AFTER INSERT ON tracking_checklists
REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION maintain_tracker_usage();
--> statement-breakpoint
CREATE TRIGGER checklists_usage_update AFTER UPDATE ON tracking_checklists
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION maintain_tracker_usage();
--> statement-breakpoint
CREATE TRIGGER checklists_usage_delete AFTER DELETE ON tracking_checklists
REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION maintain_tracker_usage();
--> statement-breakpoint
CREATE TRIGGER settings_usage_insert AFTER INSERT ON tracking_settings
REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION maintain_tracker_usage();
--> statement-breakpoint
CREATE TRIGGER settings_usage_update AFTER UPDATE ON tracking_settings
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION maintain_tracker_usage();
--> statement-breakpoint
CREATE TRIGGER settings_usage_delete AFTER DELETE ON tracking_settings
REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION maintain_tracker_usage();
--> statement-breakpoint
CREATE TRIGGER fasts_usage_insert AFTER INSERT ON tracking_fasts
REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION maintain_tracker_usage();
--> statement-breakpoint
CREATE TRIGGER fasts_usage_update AFTER UPDATE ON tracking_fasts
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION maintain_tracker_usage();
--> statement-breakpoint
CREATE TRIGGER fasts_usage_delete AFTER DELETE ON tracking_fasts
REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION maintain_tracker_usage();
