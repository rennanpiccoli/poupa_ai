CREATE TABLE "chains" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"source" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prices" (
	"ean" text NOT NULL,
	"chain_id" text NOT NULL,
	"price_cents" integer NOT NULL,
	"url" text,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prices_ean_chain_id_pk" PRIMARY KEY("ean","chain_id")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"ean" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"brand" text,
	"category" text,
	"quantity" text
);
--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_ean_products_ean_fk" FOREIGN KEY ("ean") REFERENCES "public"."products"("ean") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_chain_id_chains_id_fk" FOREIGN KEY ("chain_id") REFERENCES "public"."chains"("id") ON DELETE no action ON UPDATE no action;