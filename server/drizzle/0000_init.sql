CREATE TABLE IF NOT EXISTS "blessing_drafts" (
	"user_id" text PRIMARY KEY NOT NULL,
	"body" text NOT NULL,
	"personalization" jsonb NOT NULL,
	"occasion" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blessing_events" (
	"id" text PRIMARY KEY NOT NULL,
	"blessing_id" text NOT NULL,
	"from_state" text NOT NULL,
	"to_state" text NOT NULL,
	"trigger" text NOT NULL,
	"actor" jsonb NOT NULL,
	"reason" text,
	"at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blessings" (
	"id" text PRIMARY KEY NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"personalization" jsonb NOT NULL,
	"occasion" text NOT NULL,
	"state" text NOT NULL,
	"public_slug" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"published_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"hold_until" timestamp with time zone,
	"moderation" jsonb,
	"renew_count" integer DEFAULT 0 NOT NULL,
	"counted_in_streak" boolean DEFAULT false NOT NULL,
	CONSTRAINT "blessings_public_slug_unique" UNIQUE("public_slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "consents" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"agreement_version" text NOT NULL,
	"scope_deliver" boolean NOT NULL,
	"scope_featured" boolean NOT NULL,
	"scope_synthesis" boolean NOT NULL,
	"agreed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inbox_items" (
	"id" text PRIMARY KEY NOT NULL,
	"recipient_id" text NOT NULL,
	"sender_id" text NOT NULL,
	"blessing_id" text NOT NULL,
	"delivered_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reports" (
	"id" text PRIMARY KEY NOT NULL,
	"blessing_id" text NOT NULL,
	"origin" text NOT NULL,
	"category" text NOT NULL,
	"state" text NOT NULL,
	"priority" integer NOT NULL,
	"note" text,
	"assignee" text,
	"resolution_reason" text,
	"reporter_fingerprint" text,
	"count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"timeline" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "streak_days" (
	"user_id" text NOT NULL,
	"local_date" text NOT NULL,
	"published_count" integer NOT NULL,
	CONSTRAINT "streak_days_user_id_local_date_pk" PRIMARY KEY("user_id","local_date")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "templates" (
	"id" text PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"prompt_text" text NOT NULL,
	"sample_text" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"sender_name" text,
	"region_city" text,
	"location_granted" boolean DEFAULT false NOT NULL,
	"featured_by_default" boolean,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"wx_openid" text NOT NULL,
	"wx_unionid" text,
	"nickname" text NOT NULL,
	"avatar_url" text,
	"utc_offset_minutes" integer DEFAULT 480 NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_wx_openid_unique" UNIQUE("wx_openid")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "blessing_drafts" ADD CONSTRAINT "blessing_drafts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "blessing_events" ADD CONSTRAINT "blessing_events_blessing_id_blessings_id_fk" FOREIGN KEY ("blessing_id") REFERENCES "public"."blessings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "blessings" ADD CONSTRAINT "blessings_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inbox_items" ADD CONSTRAINT "inbox_items_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inbox_items" ADD CONSTRAINT "inbox_items_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inbox_items" ADD CONSTRAINT "inbox_items_blessing_id_blessings_id_fk" FOREIGN KEY ("blessing_id") REFERENCES "public"."blessings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reports" ADD CONSTRAINT "reports_blessing_id_blessings_id_fk" FOREIGN KEY ("blessing_id") REFERENCES "public"."blessings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "streak_days" ADD CONSTRAINT "streak_days_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
