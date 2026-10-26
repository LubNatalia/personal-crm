import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
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

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type ContactFrequency = (typeof contactFrequency.enumValues)[number];
