CREATE TABLE "sets" (
	"key" text PRIMARY KEY NOT NULL,
	"id" text NOT NULL,
	"language" text NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"release_date" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sets_code_idx" ON "sets" USING btree ("code");