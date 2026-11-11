ALTER TABLE "contacts" ADD COLUMN "birth_day" smallint;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "birth_month" smallint;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "birth_year" smallint;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_birth_day_month_check" CHECK (("contacts"."birth_day" is null) = ("contacts"."birth_month" is null));--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_birth_year_check" CHECK ("contacts"."birth_year" is null or ("contacts"."birth_day" is not null and "contacts"."birth_year" >= 1900));--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_birth_day_range_check" CHECK ("contacts"."birth_day" between 1 and 31);--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_birth_month_range_check" CHECK ("contacts"."birth_month" between 1 and 12);