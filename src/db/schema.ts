import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Tables of Better Auth (login). Names and fields are the ones the library
// expects: the Drizzle adapter finds a table by the key it is exported under
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  // Always stored in lower case; the login address is the user's identity
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// One row per signed-in device
export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

// Login methods of a user. Unused by the email link, but the library requires it
export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
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
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

// Login links waiting to be opened: the identifier holds the link's token,
// the value holds the email it was sent to
export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

// Every login email sent, to limit how many one address gets in 10 minutes.
// The address is in lower case, without spaces
export const loginEmailSends = pgTable(
  "login_email_sends",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    email: text("email").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("login_email_sends_email_sent_at_idx").on(table.email, table.sentAt),
  ],
);

// How often to keep in touch; NULL in the table means "not set"
export const contactFrequency = pgEnum("contact_frequency", [
  "week",
  "month",
  "quarter",
  "year",
]);

export const contacts = pgTable(
  "contacts",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    // Whose contact it is: every query filters by it
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // Who this person is (role, relation)
    about: text("about"),
    howWeMet: text("how_we_met"),
    phone: text("phone"),
    email: text("email"),
    // Free-form notes: what we talked about, what we agreed on
    notes: text("notes"),
    contactFrequency: contactFrequency("contact_frequency"),
    // Last time we were in touch: a new line in notes or the "contacted" tick.
    // NULL when unknown
    lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
    // When the frequency changed from "not set" to a value; NULL while not set
    frequencySetAt: timestamp("frequency_set_at", { withTimezone: true }),
    // Birth date in three parts, as the year is often unknown. All NULL when
    // not set. Which days a month has and "not in the future" are checked by
    // the code: a CHECK can't depend on today
    birthDay: smallint("birth_day"),
    birthMonth: smallint("birth_month"),
    birthYear: smallint("birth_year"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("contacts_name_idx").on(table.name),
    index("contacts_user_id_idx").on(table.userId),
    // Day and month come together; a year needs both
    check(
      "contacts_birth_day_month_check",
      sql`(${table.birthDay} is null) = (${table.birthMonth} is null)`,
    ),
    check(
      "contacts_birth_year_check",
      sql`${table.birthYear} is null or (${table.birthDay} is not null and ${table.birthYear} >= 1900)`,
    ),
    check(
      "contacts_birth_day_range_check",
      sql`${table.birthDay} between 1 and 31`,
    ),
    check(
      "contacts_birth_month_range_check",
      sql`${table.birthMonth} between 1 and 12`,
    ),
  ],
);

// Groups of contacts, made up by the user ("Family", "Tennis")
export const groups = pgTable(
  "groups",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Names are unique per user regardless of letter case: "Tennis" and
    // "tennis" are one name, but two users may both have "Tennis"
    uniqueIndex("groups_user_id_name_lower_idx").on(
      table.userId,
      sql`lower(${table.name})`,
    ),
  ],
);

// A contact can be in several groups, a group holds several contacts.
// Deleting either side removes the link, never the other side
export const contactGroups = pgTable(
  "contact_groups",
  {
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    groupId: integer("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.contactId, table.groupId] }),
    // The primary key starts with contact_id, so it can't serve a search by group
    index("contact_groups_group_id_idx").on(table.groupId),
  ],
);

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type Group = typeof groups.$inferSelect;
export type User = typeof user.$inferSelect;
export type ContactFrequency = (typeof contactFrequency.enumValues)[number];
