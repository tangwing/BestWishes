CREATE TABLE IF NOT EXISTS "audio_scores" (
	"blessing_id" text PRIMARY KEY NOT NULL,
	"completeness" text NOT NULL,
	"focus" text NOT NULL,
	"focus_confidence" double precision NOT NULL,
	"sincerity" text NOT NULL,
	"sincerity_confidence" double precision NOT NULL,
	"personalization" text NOT NULL,
	"liveness_passed" boolean NOT NULL,
	"computed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wish_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"author_id" text NOT NULL,
	"situation_text" text NOT NULL,
	"script_text" text,
	"state" text DEFAULT 'published' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"recipient_candidate_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"moderation" jsonb
);
--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "blessing_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "blessings" ADD COLUMN "request_id" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "request_id" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audio_scores" ADD CONSTRAINT "audio_scores_blessing_id_blessings_id_fk" FOREIGN KEY ("blessing_id") REFERENCES "public"."blessings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wish_requests" ADD CONSTRAINT "wish_requests_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "blessings" ADD CONSTRAINT "blessings_request_id_wish_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."wish_requests"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_request_id_wish_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."wish_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
