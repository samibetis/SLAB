CREATE TABLE "cards" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"set_id" text NOT NULL,
	"set_name" text NOT NULL,
	"local_id" text NOT NULL,
	"number" text NOT NULL,
	"year" integer,
	"language" text NOT NULL,
	"edition" text,
	"rarity" text,
	"type" text,
	"image_url" text,
	"image_thumb_url" text,
	"image_needs_proxy" boolean DEFAULT false NOT NULL,
	"external_ids" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"variants" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cards_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE INDEX "cards_name_idx" ON "cards" USING btree ("name");--> statement-breakpoint
CREATE INDEX "cards_set_idx" ON "cards" USING btree ("set_id");