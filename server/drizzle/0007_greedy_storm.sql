ALTER TABLE "blessings" ADD COLUMN "view_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "wish_requests" ADD COLUMN "beneficiary_label" text;--> statement-breakpoint
ALTER TABLE "wish_requests" ADD COLUMN "view_count" integer DEFAULT 0 NOT NULL;