CREATE TABLE "set_rankings" (
	"set_key" text PRIMARY KEY NOT NULL,
	"language" text NOT NULL,
	"currency" text NOT NULL,
	"source" text NOT NULL,
	"card_count" integer NOT NULL,
	"priced_count" integer NOT NULL,
	"top" jsonb NOT NULL,
	"scanned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "set_rankings_lang_idx" ON "set_rankings" USING btree ("language","scanned_at");