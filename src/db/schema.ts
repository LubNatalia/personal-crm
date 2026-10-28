import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("contacts_name_idx").on(table.name)],
);

// Groups of contacts, made up by the user ("Family", "Tennis")
export const groups = pgTable(
  "groups",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Names are unique regardless of letter case: "Tennis" and "tennis"
    uniqueIndex("groups_name_lower_idx").on(sql`lower(${table.name})`),
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
export type ContactFrequency = (typeof contactFrequency.enumValues)[number];
