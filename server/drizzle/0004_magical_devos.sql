ALTER TABLE "reports" ALTER COLUMN "blessing_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "request_id" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reports" ADD CONSTRAINT "reports_request_id_wish_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."wish_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
