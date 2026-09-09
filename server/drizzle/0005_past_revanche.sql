ALTER TABLE "wish_requests" ADD COLUMN "response_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "wish_requests" ADD COLUMN "last_response_at" timestamp with time zone;