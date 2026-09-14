ALTER TABLE "wish_requests" ADD COLUMN "anonymous" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "wish_requests" ADD COLUMN "last_response_excerpt" text;