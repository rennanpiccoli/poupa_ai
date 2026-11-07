CREATE TABLE "chain_products" (
	"chain_id" text NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"brand" text,
	"price_cents" integer NOT NULL,
	"regular_price_cents" integer,
	"promo_text" text,
	"size_text" text,
	"size_dimension" text,
	"size_amount" double precision,
	"size_packs" integer,
	"category" text,
	"url" text NOT NULL,
	"image_url" text,
	"available" boolean DEFAULT true NOT NULL,
	"ean" text,
	"price_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"details_fetched_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chain_products_chain_id_sku_pk" PRIMARY KEY("chain_id","sku")
);
--> statement-breakpoint
CREATE TABLE "product_matches" (
	"chain_id" text NOT NULL,
	"sku" text NOT NULL,
	"canonical_key" text NOT NULL,
	"method" text NOT NULL,
	"status" text NOT NULL,
	"score" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_matches_chain_id_sku_canonical_key_pk" PRIMARY KEY("chain_id","sku","canonical_key")
);
--> statement-breakpoint
CREATE TABLE "search_cache" (
	"term" text NOT NULL,
	"chain_id" text NOT NULL,
	"skus" text[] NOT NULL,
	"error" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "search_cache_term_chain_id_pk" PRIMARY KEY("term","chain_id")
);
--> statement-breakpoint
CREATE INDEX "chain_products_ean_idx" ON "chain_products" USING btree ("ean");--> statement-breakpoint
CREATE INDEX "product_matches_key_idx" ON "product_matches" USING btree ("canonical_key");