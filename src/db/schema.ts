import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  bigint,
  uuid,
  jsonb,
  date,
  uniqueIndex,
  primaryKey,
  index,
  check,
} from "drizzle-orm/pg-core";

export const user = pgTable("auth_user", {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  role: text().default("user"),
  banned: boolean().default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires", { withTimezone: true }),
});
export const session = pgTable(
  "auth_session",
  {
    id: text().primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text().notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    impersonatedBy: text("impersonated_by"),
  },
  (table) => [
    index("session_user_idx").on(table.userId),
    index("session_expiry_idx").on(table.expiresAt),
  ],
);
export const account = pgTable(
  "auth_account",
  {
    id: text().primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text(),
    password: text(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("account_provider_unique").on(
      table.providerId,
      table.accountId,
    ),
    index("account_user_idx").on(table.userId),
  ],
);
export const verification = pgTable(
  "auth_verification",
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("verification_identifier_idx").on(table.identifier),
    index("verification_expiry_idx").on(table.expiresAt),
  ],
);
export const rateLimit = pgTable(
  "auth_rate_limit",
  {
    id: text().primaryKey(),
    key: text().notNull().unique(),
    count: integer().notNull(),
    lastRequest: bigint("last_request", { mode: "number" }).notNull(),
  },
  (t) => [index("auth_rate_limit_last_request_idx").on(t.lastRequest)],
);
export const requestBuckets = pgTable(
  "request_buckets",
  {
    key: text().primaryKey(),
    count: integer().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("request_buckets_expiry_idx").on(t.expiresAt)],
);
const fields = () => ({
  id: uuid().notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  date: date(),
  category: text(),
  data: jsonb().$type<Record<string, unknown>>().notNull(),
  revision: integer().notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const entries = pgTable("tracking_entries", fields(), (t) => [
  primaryKey({ columns: [t.userId, t.id] }),
  index("entries_user_date_idx").on(t.userId, t.date, t.category),
  check("entry_date_required", sql`${t.date} IS NOT NULL`),
]);
export const schedules = pgTable("tracking_schedules", fields(), (t) => [
  primaryKey({ columns: [t.userId, t.id] }),
  index("schedules_user_idx").on(t.userId),
]);
export const checklists = pgTable("tracking_checklists", fields(), (t) => [
  primaryKey({ columns: [t.userId, t.id] }),
  uniqueIndex("checklist_user_date_key").on(
    t.userId,
    t.date,
    sql`(${t.data}->>'key')`,
  ),
]);
export const settings = pgTable("tracking_settings", fields(), (t) => [
  primaryKey({ columns: [t.userId, t.id] }),
  uniqueIndex("settings_user_unique").on(t.userId),
]);
export const fasts = pgTable("tracking_fasts", fields(), (t) => [
  primaryKey({ columns: [t.userId, t.id] }),
  index("fasts_user_date_idx").on(t.userId, t.date),
  uniqueIndex("one_active_fast_per_user")
    .on(t.userId)
    .where(sql`${t.data}->>'endTimestampMs' IS NULL`),
]);
export const receipts = pgTable(
  "mutation_receipts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    key: uuid().notNull(),
    hash: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.key] }),
    index("mutation_receipts_created_idx").on(t.createdAt),
  ],
);
export const imports = pgTable("data_imports", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  fingerprint: text().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Counters are maintained by transactional triggers in the migration.
export const registrationCapacity = pgTable(
  "registration_capacity",
  {
    id: integer().primaryKey().default(1),
    maxUsers: integer("max_users").notNull().default(100),
    registeredUsers: integer("registered_users").notNull().default(0),
  },
  (t) => [
    check("registration_singleton", sql`${t.id} = 1`),
    check(
      "registration_valid",
      sql`${t.maxUsers} >= 0 AND ${t.registeredUsers} >= 0`,
    ),
  ],
);
export const trackerUsage = pgTable("tracker_usage", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  rowCount: integer("row_count").notNull().default(0),
  dataBytes: bigint("data_bytes", { mode: "number" }).notNull().default(0),
});
