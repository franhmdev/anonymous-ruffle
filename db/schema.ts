import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
};

export const groupStatus = pgEnum("group_status", ["draft", "drawn"]);
export const participantStatus = pgEnum("participant_status", ["pending", "accepted"]);

// Users without email are guests that joined through an invitation link.
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email"),
    ...timestamps,
  },
  (t) => [uniqueIndex("users_email_unique").on(t.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    device: text("device"),
    ...timestamps,
  },
  (t) => [uniqueIndex("sessions_token_hash_unique").on(t.tokenHash), index("sessions_user_idx").on(t.userId)],
);

// One-time login codes. `linkUserId` is set when a guest links an email to their account.
export const loginCodes = pgTable(
  "login_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name"),
    codeHash: text("code_hash").notNull(),
    linkTokenHash: text("link_token_hash").notNull(),
    linkUserId: uuid("link_user_id").references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    usedAt: timestamp("used_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("login_codes_email_idx").on(t.email), uniqueIndex("login_codes_link_token_unique").on(t.linkTokenHash)],
);

export const groups = pgTable(
  "groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminId: uuid("admin_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // Approximate budget in whole euros.
    budget: integer("budget"),
    deliveryDate: date("delivery_date", { mode: "string" }),
    status: groupStatus("status").notNull().default("draft"),
    scheduledDrawAt: timestamp("scheduled_draw_at", { withTimezone: true }),
    // IANA time zone used to render dates in emails.
    timezone: text("timezone").notNull().default("Europe/Madrid"),
    surpriseMode: boolean("surprise_mode").notNull().default(false),
    surpriseRevealedAt: timestamp("surprise_revealed_at", { withTimezone: true }),
    drawnAt: timestamp("drawn_at", { withTimezone: true }),
    lastDrawError: text("last_draw_error"),
    ...timestamps,
  },
  (t) => [
    index("groups_admin_idx").on(t.adminId),
    index("groups_scheduled_idx")
      .on(t.scheduledDrawAt)
      .where(sql`${t.status} = 'draft'`),
  ],
);

export const participants = pgTable(
  "participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    status: participantStatus("status").notNull().default("pending"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("participants_group_user_unique").on(t.groupId, t.userId),
    index("participants_user_idx").on(t.userId),
  ],
);

// Group-wide invitation when `participantId` is null, personal invitation otherwise.
export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id").references(() => participants.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("invitations_token_hash_unique").on(t.tokenHash), index("invitations_group_idx").on(t.groupId)],
);

// Symmetric exclusion: stored with participantA < participantB.
export const exclusions = pgTable(
  "exclusions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    participantA: uuid("participant_a")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    participantB: uuid("participant_b")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("exclusions_pair_unique").on(t.groupId, t.participantA, t.participantB),
    check("exclusions_ordered_pair", sql`${t.participantA} < ${t.participantB}`),
  ],
);

export const assignments = pgTable(
  "assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    giverId: uuid("giver_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    receiverId: uuid("receiver_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("assignments_group_giver_unique").on(t.groupId, t.giverId),
    uniqueIndex("assignments_group_receiver_unique").on(t.groupId, t.receiverId),
    check("assignments_not_self", sql`${t.giverId} <> ${t.receiverId}`),
  ],
);

export const wishlistItems = pgTable(
  "wishlist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    url: text("url"),
    ...timestamps,
  },
  (t) => [index("wishlist_participant_idx").on(t.participantId)],
);

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("push_endpoint_unique").on(t.endpoint)],
);

// Fixed-window counters for rate limiting (shared across serverless instances).
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  participations: many(participants),
  adminGroups: many(groups),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  admin: one(users, { fields: [groups.adminId], references: [users.id] }),
  participants: many(participants),
  exclusions: many(exclusions),
}));

export const participantsRelations = relations(participants, ({ one, many }) => ({
  group: one(groups, { fields: [participants.groupId], references: [groups.id] }),
  user: one(users, { fields: [participants.userId], references: [users.id] }),
  wishlist: many(wishlistItems),
}));

export const exclusionsRelations = relations(exclusions, ({ one }) => ({
  group: one(groups, { fields: [exclusions.groupId], references: [groups.id] }),
}));

export const wishlistItemsRelations = relations(wishlistItems, ({ one }) => ({
  participant: one(participants, { fields: [wishlistItems.participantId], references: [participants.id] }),
}));

export type User = typeof users.$inferSelect;
export type Group = typeof groups.$inferSelect;
export type Participant = typeof participants.$inferSelect;
export type WishlistItem = typeof wishlistItems.$inferSelect;
