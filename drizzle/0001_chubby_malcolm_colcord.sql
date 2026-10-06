CREATE TABLE "price_points" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"card_id" text NOT NULL,
	"variant" text NOT NULL,
	"grader" text NOT NULL,
	"grade" real,
	"date" date NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"currency" text NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "variant_options" jsonb;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "release_date" text;--> statement-breakpoint
ALTER TABLE "price_points" ADD CONSTRAINT "price_points_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "price_points_lookup_idx" ON "price_points" USING btree ("card_id","variant","grader","grade","date");--> statement-breakpoint
CREATE UNIQUE INDEX "price_points_unique_idx" ON "price_points" USING btree ("card_id","variant","grader",coalesce("grade", -1),"date","source");