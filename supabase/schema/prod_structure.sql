


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."get_next_document_number"("p_company_id" "uuid", "p_document_type" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_year integer;
  v_prefix text := public.resolve_document_prefix(p_document_type);
  v_padding integer := 6;
  v_next integer;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'p_company_id é obrigatório';
  END IF;

  IF p_document_type = 'customer' THEN
    v_year := 0;
  ELSE
    v_year := EXTRACT(YEAR FROM CURRENT_DATE)::integer;
  END IF;

  INSERT INTO public.document_sequences (
    company_id,
    document_type,
    prefix,
    year,
    current_number,
    padding,
    active
  )
  VALUES (
    p_company_id,
    p_document_type,
    v_prefix,
    v_year,
    1,
    v_padding,
    true
  )
  ON CONFLICT (company_id, document_type, year)
  DO UPDATE SET
    current_number = public.document_sequences.current_number + 1,
    updated_at = now()
  RETURNING current_number, padding, prefix
  INTO v_next, v_padding, v_prefix;

  IF p_document_type = 'customer' THEN
    RETURN v_prefix || lpad(v_next::text, v_padding, '0');
  END IF;

  RETURN v_prefix || '-' || v_year::text || '-' || lpad(v_next::text, v_padding, '0');
END;
$$;


ALTER FUNCTION "public"."get_next_document_number"("p_company_id" "uuid", "p_document_type" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_next_document_number"("p_company_id" "uuid", "p_document_type" "text") IS 'Allocates next document number atomically. Types: quote, order, service_order.';



CREATE OR REPLACE FUNCTION "public"."resolve_document_prefix"("p_document_type" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
  CASE p_document_type
    WHEN 'quote' THEN RETURN 'Q';
    WHEN 'order' THEN RETURN 'O';
    WHEN 'service_order' THEN RETURN 'SO';
    WHEN 'customer' THEN RETURN 'AB';
    ELSE
      RAISE EXCEPTION
        'document_type inválido: % (use quote, order, service_order ou customer)',
        p_document_type;
  END CASE;
END;
$$;


ALTER FUNCTION "public"."resolve_document_prefix"("p_document_type" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."app_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "role_key" character varying(50) NOT NULL,
    "label_pt" character varying(100),
    "label_en" character varying(100),
    "label_es" character varying(100),
    "active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."app_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "full_name" character varying(255) NOT NULL,
    "email" character varying(255),
    "role_key" character varying(50) DEFAULT 'user'::character varying,
    "preferred_language" character varying(10) DEFAULT 'pt'::character varying,
    "active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."app_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "branch_id" "uuid",
    "user_id" "uuid",
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid",
    "action" "text" NOT NULL,
    "old_data" "jsonb",
    "new_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."branches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text",
    "branch_code" "text",
    "address_line1" "text",
    "address_line2" "text",
    "city" "text",
    "state" "text",
    "postal_code" "text",
    "country" "text" DEFAULT 'USA'::"text",
    "timezone" "text" DEFAULT 'America/New_York'::"text",
    "phone" "text",
    "email" "text",
    "google_calendar_enabled" boolean DEFAULT false,
    "google_calendar_id" "text",
    "service_radius_miles" numeric DEFAULT 0,
    "mileage_fee_per_mile" numeric DEFAULT 0,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."branches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."catalog_item_prices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "branch_id" "uuid",
    "catalog_item_id" "uuid" NOT NULL,
    "price_type" "text" DEFAULT 'SALE'::"text" NOT NULL,
    "currency_code" "text" DEFAULT 'USD'::"text" NOT NULL,
    "amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "pricing_type" "text" DEFAULT 'PER_PERSON'::"text",
    "charge_type" "text" DEFAULT 'PERSON'::"text",
    "valid_from" timestamp with time zone DEFAULT "now"() NOT NULL,
    "valid_until" timestamp with time zone,
    "active" boolean DEFAULT true,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."catalog_item_prices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."catalog_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "item_name" character varying(255) NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "charge_type" character varying(50) NOT NULL,
    "unit_label" character varying(50),
    "active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "item_key" character varying(100),
    "label_pt" character varying(255),
    "label_en" character varying(255),
    "label_es" character varying(255),
    "category_key" character varying(100),
    "category_pt" character varying(255),
    "category_en" character varying(255),
    "category_es" character varying(255),
    "quantity" numeric(10,2),
    "unit" character varying(20),
    "quantity_2" numeric(10,2),
    "uom_2" character varying(20),
    "pricing_type" character varying(50),
    "image_url" "text",
    "image_status" character varying(30) DEFAULT 'missing'::character varying,
    "image_notes" "text",
    "currency_code" character varying(10) DEFAULT 'USD'::character varying,
    "display_order" integer DEFAULT 1,
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "branch_id" "uuid",
    "can_be_package_item" boolean DEFAULT true,
    "can_be_side_item" boolean DEFAULT false,
    "can_be_additional" boolean DEFAULT true,
    "can_be_option_choice" boolean DEFAULT true,
    "inventory_enabled" boolean DEFAULT false,
    "cost_price" numeric DEFAULT 0,
    "sale_price" numeric,
    "item_type" "text",
    "customer_visible" boolean DEFAULT true,
    "operational_item" boolean DEFAULT false,
    "stock_unit" "text",
    "purchase_unit" "text",
    "conversion_factor" numeric DEFAULT 1,
    "min_stock_qty" numeric DEFAULT 0,
    "current_stock_qty" numeric DEFAULT 0
);


ALTER TABLE "public"."catalog_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commercial_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "rule_key" "text" NOT NULL,
    "rule_value" "jsonb" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "rule_type" "text"
);


ALTER TABLE "public"."commercial_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_name" character varying(255) NOT NULL,
    "company_code" character varying(50) NOT NULL,
    "active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "default_language" character varying(10) DEFAULT 'pt'::character varying,
    "currency_code" character varying(10) DEFAULT 'USD'::character varying,
    "timezone" character varying(100) DEFAULT 'America/New_York'::character varying,
    "logo_url" "text",
    "primary_color" character varying(20),
    "secondary_color" character varying(20),
    "google_calendar_enabled" boolean DEFAULT false,
    "google_calendar_id" "text",
    "google_calendar_timezone" "text" DEFAULT 'America/New_York'::"text",
    "franchise_group_id" "uuid",
    "legal_name" "text",
    "trade_name" "text",
    "slug" "text",
    "billing_email" "text",
    "phone" "text",
    "website" "text",
    "default_currency" "text" DEFAULT 'USD'::"text",
    "default_timezone" "text" DEFAULT 'America/New_York'::"text",
    "subscription_status" "text" DEFAULT 'active'::"text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."companies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "asset_name" character varying(255),
    "asset_type" character varying(100),
    "file_url" "text",
    "active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."company_assets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_features" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "feature_key" "text" NOT NULL,
    "enabled" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."company_features" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "ab_name" character varying(255),
    "phone" character varying(50),
    "email" character varying(255),
    "address" "text",
    "city" character varying(100),
    "state" character varying(100),
    "created_at" timestamp without time zone DEFAULT "now"(),
    "customer_type" character varying,
    "full_name" character varying,
    "company_name" character varying,
    "address_line" character varying,
    "postal_code" character varying,
    "country" character varying DEFAULT 'US'::character varying,
    "preferred_language" character varying DEFAULT 'pt'::character varying,
    "notes" "text",
    "active" boolean DEFAULT true,
    "ab_number" integer,
    "ab_type" character varying(10),
    "legacy_id" integer,
    "address_book_role" character varying(50),
    "contact_name" character varying,
    "tax_id" character varying,
    "website" character varying,
    "source" character varying(50) DEFAULT 'manual'::character varying,
    "tags" "text",
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "phone_normalized" "text",
    "branch_id" "uuid"
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


COMMENT ON COLUMN "public"."customers"."phone_normalized" IS 'Telefone somente dígitos — usado para busca e índice único por empresa.';



CREATE TABLE IF NOT EXISTS "public"."document_sequences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "document_type" "text" NOT NULL,
    "prefix" "text" NOT NULL,
    "year" integer NOT NULL,
    "current_number" integer DEFAULT 0 NOT NULL,
    "padding" integer DEFAULT 6 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    CONSTRAINT "document_sequences_document_type_check" CHECK (("document_type" = ANY (ARRAY['quote'::"text", 'order'::"text", 'service_order'::"text", 'customer'::"text"])))
);


ALTER TABLE "public"."document_sequences" OWNER TO "postgres";


COMMENT ON TABLE "public"."document_sequences" IS 'Per-company document counters. quote=Q, order=O, service_order=SO.';



CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "customer_id" "uuid",
    "event_date" "date",
    "event_location" "text",
    "adults" integer DEFAULT 0,
    "children" integer DEFAULT 0,
    "status" character varying(50) DEFAULT 'draft'::character varying,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "event_name" character varying,
    "event_type" character varying,
    "event_time" time without time zone,
    "guests" integer,
    "venue_name" character varying,
    "address_line" character varying,
    "city" character varying,
    "state" character varying,
    "postal_code" character varying,
    "country" character varying DEFAULT 'US'::character varying,
    "notes" "text",
    "start_time" time without time zone,
    "end_time" time without time zone,
    "duration_hours" numeric DEFAULT 4,
    "adults_count" integer DEFAULT 0,
    "children_count" integer DEFAULT 0,
    "billable_guests" numeric,
    "has_grill" boolean,
    "grill_photo_required" boolean DEFAULT false,
    "grill_photo_url" "text",
    "grill_rental_required" boolean DEFAULT false,
    "grill_rental_qty" integer DEFAULT 0,
    "grill_notes" "text",
    "grill_masters_qty" integer DEFAULT 1,
    "assistants_qty" integer DEFAULT 1,
    "grill_photo_media_id" "uuid",
    "distance_from_base" numeric(10,2),
    "mileage_notes" "text",
    "total_guests" integer,
    "meats_included" boolean DEFAULT true,
    "disposables_included" boolean DEFAULT false,
    "disposables_notes" "text",
    "customer_notes" "text",
    "internal_notes" "text",
    "active" boolean DEFAULT true,
    "timezone" character varying(100) DEFAULT 'America/New_York'::character varying,
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."franchise_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "legal_name" "text",
    "slug" "text",
    "website" "text",
    "contact_email" "text",
    "contact_phone" "text",
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."franchise_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."languages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "language_code" character varying(10) NOT NULL,
    "language_name" character varying(100) NOT NULL,
    "active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."languages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."media_assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "entity_type" character varying(50) NOT NULL,
    "entity_id" "uuid",
    "entity_key" character varying(100),
    "media_type" character varying(50) DEFAULT 'image'::character varying,
    "media_url" "text",
    "storage_path" "text",
    "label_pt" character varying(255),
    "label_en" character varying(255),
    "label_es" character varying(255),
    "display_order" integer DEFAULT 1,
    "active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."media_assets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."package_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "category_key" character varying(100) NOT NULL,
    "label_pt" character varying(255) NOT NULL,
    "label_en" character varying(255) NOT NULL,
    "label_es" character varying(255) NOT NULL,
    "display_order" integer DEFAULT 0,
    "active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."package_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."package_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "package_id" "uuid",
    "category_id" "uuid",
    "item_name" character varying(255) NOT NULL,
    "included" boolean DEFAULT true,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "item_key" character varying,
    "label_pt" character varying,
    "label_en" character varying,
    "label_es" character varying,
    "quantity" numeric,
    "unit" character varying,
    "choice_group" character varying,
    "choice_type" character varying,
    "active" boolean DEFAULT true,
    "image_url" "text",
    "image_status" character varying(30) DEFAULT 'missing'::character varying,
    "image_notes" "text",
    "branch_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "additional_item_id" "uuid",
    "description_pt" "text",
    "description_en" "text",
    "description_es" "text",
    "unit_label_pt" "text",
    "unit_label_en" "text",
    "unit_label_es" "text",
    "is_choice_placeholder" boolean DEFAULT false,
    "blocks_additional_item" boolean DEFAULT false
);


ALTER TABLE "public"."package_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."package_option_group_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "option_group_id" "uuid" NOT NULL,
    "additional_item_id" "uuid",
    "option_item_key" character varying NOT NULL,
    "label_pt" character varying NOT NULL,
    "label_en" character varying,
    "label_es" character varying,
    "description_pt" "text",
    "description_en" "text",
    "description_es" "text",
    "image_url" "text",
    "display_order" integer DEFAULT 0,
    "active" boolean DEFAULT true,
    "price_delta" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "branch_id" "uuid"
);


ALTER TABLE "public"."package_option_group_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."package_option_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "package_id" "uuid" NOT NULL,
    "option_group_key" character varying(100) NOT NULL,
    "label_pt" character varying(255) NOT NULL,
    "label_en" character varying(255) NOT NULL,
    "label_es" character varying(255) NOT NULL,
    "required" boolean DEFAULT true,
    "display_order" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "group_key" "text" DEFAULT 'pending_group_key'::"text" NOT NULL,
    "title_pt" "text",
    "title_en" "text",
    "title_es" "text",
    "description_pt" "text",
    "description_en" "text",
    "description_es" "text",
    "min_choices" integer DEFAULT 1 NOT NULL,
    "max_choices" integer DEFAULT 1 NOT NULL,
    "is_required" boolean DEFAULT true NOT NULL,
    "blocks_additional_items" boolean DEFAULT true NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "branch_id" "uuid"
);


ALTER TABLE "public"."package_option_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."package_option_values" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "option_group_id" "uuid" NOT NULL,
    "value_key" character varying(100) NOT NULL,
    "label_pt" character varying(255) NOT NULL,
    "label_en" character varying(255) NOT NULL,
    "label_es" character varying(255) NOT NULL,
    "display_order" integer DEFAULT 1,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."package_option_values" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."package_side_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "package_id" "uuid" NOT NULL,
    "additional_item_id" "uuid",
    "item_key" character varying NOT NULL,
    "label_pt" character varying NOT NULL,
    "label_en" character varying,
    "label_es" character varying,
    "description_pt" "text",
    "description_en" "text",
    "description_es" "text",
    "quantity" numeric DEFAULT 1,
    "unit_label_pt" character varying,
    "unit_label_en" character varying,
    "unit_label_es" character varying,
    "included" boolean DEFAULT true,
    "blocks_additional_item" boolean DEFAULT false,
    "display_order" integer DEFAULT 0,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "branch_id" "uuid",
    "item_name" "text"
);


ALTER TABLE "public"."package_side_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "package_name" character varying(255) NOT NULL,
    "price_per_person" numeric(10,2),
    "description" "text",
    "active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "package_key" character varying(100),
    "label_pt" character varying(255),
    "label_en" character varying(255),
    "label_es" character varying(255),
    "description_pt" "text",
    "description_en" "text",
    "description_es" "text",
    "display_order" integer DEFAULT 0,
    "image_url" "text",
    "currency_code" character varying(10) DEFAULT 'USD'::character varying,
    "image_status" character varying(30) DEFAULT 'missing'::character varying,
    "image_notes" "text",
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "items_description_pt" "text",
    "garnish_description_pt" "text",
    "sides_description_pt" "text",
    "package_highlights_pt" "text",
    "package_highlights_en" "text",
    "package_highlights_es" "text",
    "branch_id" "uuid",
    "highlight_pt" "text",
    "highlight_en" "text",
    "highlight_es" "text"
);


ALTER TABLE "public"."packages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "rule_key" character varying(100) NOT NULL,
    "label_pt" character varying(255) NOT NULL,
    "label_en" character varying(255) NOT NULL,
    "label_es" character varying(255) NOT NULL,
    "rule_value" numeric,
    "rule_text_pt" "text",
    "rule_text_en" "text",
    "rule_text_es" "text",
    "active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."payment_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quote_additional_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "quote_id" "uuid" NOT NULL,
    "additional_item_id" "uuid" NOT NULL,
    "quantity" numeric DEFAULT 1,
    "unit_price" numeric DEFAULT 0,
    "total_price" numeric DEFAULT 0,
    "selected" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."quote_additional_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quote_option_selections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "quote_id" "uuid" NOT NULL,
    "option_group_key" character varying(100) NOT NULL,
    "selected_value_key" character varying(100) NOT NULL,
    "label_pt" character varying(255),
    "label_en" character varying(255),
    "label_es" character varying(255),
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."quote_option_selections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quotes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "customer_id" "uuid",
    "event_id" "uuid",
    "package_id" "uuid",
    "quote_status" character varying(50) DEFAULT 'draft'::character varying,
    "subtotal" numeric(10,2) DEFAULT 0,
    "discount" numeric(10,2) DEFAULT 0,
    "deposit_amount" numeric(10,2) DEFAULT 0,
    "total_amount" numeric(10,2) DEFAULT 0,
    "balance_due" numeric(10,2) DEFAULT 0,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "quote_number" character varying(50),
    "language" character varying DEFAULT 'pt'::character varying,
    "adults_count" integer DEFAULT 0,
    "children_count" integer DEFAULT 0,
    "billable_guests" numeric DEFAULT 0,
    "package_price_per_person" numeric DEFAULT 0,
    "additional_total" numeric DEFAULT 0,
    "grill_rental_total" numeric DEFAULT 0,
    "discount_amount" numeric DEFAULT 0,
    "package_total" numeric DEFAULT 0,
    "quote_total" numeric DEFAULT 0,
    "reservation_amount" numeric DEFAULT 0,
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "version" integer DEFAULT 1,
    "quote_date" "date" DEFAULT CURRENT_DATE,
    "expiration_date" "date",
    "reservation_type" character varying(20),
    "reservation_percentage" numeric(5,2),
    "reservation_fixed_amount" numeric(12,2),
    "reservation_suggested_amount" numeric(12,2),
    "reservation_manual_amount" numeric(12,2),
    "reservation_notes" "text",
    "mileage_base_location" character varying(255),
    "mileage_distance" numeric(10,2),
    "mileage_free_limit" numeric(10,2),
    "mileage_rate" numeric(10,2),
    "mileage_fee" numeric(12,2) DEFAULT 0,
    "total_guests" integer,
    "additional_per_person_total" numeric(12,2) DEFAULT 0,
    "additional_per_unit_total" numeric(12,2) DEFAULT 0,
    "garnish_total" numeric(12,2) DEFAULT 0,
    "event_total_before_discount" numeric(12,2) DEFAULT 0,
    "minimum_order_amount" numeric(12,2) DEFAULT 0,
    "minimum_order_applied" boolean DEFAULT false,
    "discount_notes" "text",
    "quote_notes" "text",
    "internal_notes" "text",
    "active" boolean DEFAULT true,
    "currency_code" character varying(10) DEFAULT 'USD'::character varying,
    "source" character varying(50) DEFAULT 'manual'::character varying,
    "created_by" "uuid",
    "updated_by" "uuid",
    "adult_count" integer DEFAULT 0,
    "children_under_3_count" integer DEFAULT 0,
    "children_4_to_12_count" integer DEFAULT 0,
    "billable_guest_count" numeric DEFAULT 0,
    "physical_guest_count" integer DEFAULT 0 NOT NULL,
    "has_grill" boolean DEFAULT false,
    "grill_photo_required" boolean DEFAULT false,
    "grill_rental_required" boolean DEFAULT false,
    "grill_rental_qty" integer DEFAULT 0,
    "grill_notes" "text",
    "google_calendar_event_id" "text",
    "calendar_sync_status" "text" DEFAULT 'not_synced'::"text",
    "calendar_synced_at" timestamp with time zone,
    "branch_id" "uuid"
);


ALTER TABLE "public"."quotes" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."quote_detail_view" AS
 SELECT "q"."id",
    "q"."company_id",
    "q"."quote_number",
    "q"."quote_status",
    "q"."language",
    "q"."created_at",
    "c"."ab_name" AS "customer_name",
    "c"."phone" AS "customer_phone",
    "c"."email" AS "customer_email",
    "e"."event_name",
    "e"."event_type",
    "e"."event_date",
    "e"."start_time",
    "e"."end_time",
    "e"."duration_hours",
    "e"."venue_name",
    "e"."address_line",
    "e"."city",
    "e"."state",
    "e"."postal_code",
    "e"."country",
    "e"."notes" AS "event_notes",
    "e"."adults_count",
    "e"."children_count",
    "e"."billable_guests",
    "e"."has_grill",
    "e"."grill_photo_required",
    "e"."grill_photo_url",
    "e"."grill_rental_required",
    "e"."grill_rental_qty",
    "e"."grill_notes",
    "e"."grill_masters_qty",
    "e"."assistants_qty",
    "p"."package_key",
    "p"."label_pt" AS "package_name_pt",
    "p"."label_en" AS "package_name_en",
    "p"."label_es" AS "package_name_es",
    "q"."package_price_per_person",
    "q"."package_total",
    "q"."additional_total",
    "q"."grill_rental_total",
    "q"."mileage_base_location",
    "q"."mileage_distance",
    "q"."mileage_free_limit",
    "q"."mileage_rate",
    "q"."mileage_fee",
    "q"."quote_total",
    "q"."reservation_amount",
    "q"."balance_due",
    "q"."reservation_type",
    "q"."reservation_percentage",
    "q"."reservation_manual_amount",
    "q"."reservation_notes",
    ( SELECT COALESCE("json_agg"("json_build_object"('item_id', "ai"."id", 'item_key', "ai"."item_key", 'label_pt', "ai"."label_pt", 'label_en', "ai"."label_en", 'label_es', "ai"."label_es", 'category_pt', "ai"."category_pt", 'category_en', "ai"."category_en", 'category_es', "ai"."category_es", 'quantity', "qai"."quantity", 'unit_price', "qai"."unit_price", 'total_price', "qai"."total_price", 'image_url', "ai"."image_url", 'image_status', "ai"."image_status") ORDER BY "ai"."category_pt", "ai"."label_pt"), '[]'::json) AS "coalesce"
           FROM ("public"."quote_additional_items" "qai"
             JOIN "public"."catalog_items" "ai" ON (("ai"."id" = "qai"."additional_item_id")))
          WHERE (("qai"."quote_id" = "q"."id") AND (COALESCE("qai"."selected", true) = true))) AS "additional_items",
    ( SELECT COALESCE("json_agg"("json_build_object"('option_group_key', "qos"."option_group_key", 'selected_value_key', "qos"."selected_value_key", 'label_pt', "qos"."label_pt", 'label_en', "qos"."label_en", 'label_es', "qos"."label_es") ORDER BY "qos"."option_group_key"), '[]'::json) AS "coalesce"
           FROM "public"."quote_option_selections" "qos"
          WHERE ("qos"."quote_id" = "q"."id")) AS "option_selections"
   FROM ((("public"."quotes" "q"
     LEFT JOIN "public"."customers" "c" ON (("c"."id" = "q"."customer_id")))
     LEFT JOIN "public"."events" "e" ON (("e"."id" = "q"."event_id")))
     LEFT JOIN "public"."packages" "p" ON (("p"."id" = "q"."package_id")));


ALTER VIEW "public"."quote_detail_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quote_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "quote_id" "uuid",
    "additional_item_id" "uuid",
    "item_name" character varying(255) NOT NULL,
    "quantity" numeric(10,2) DEFAULT 1,
    "unit_price" numeric(10,2) DEFAULT 0,
    "total_price" numeric(10,2) DEFAULT 0,
    "charge_type" character varying(50),
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."quote_items" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."quote_list_view" AS
 SELECT "q"."id",
    "q"."company_id",
    "q"."quote_number",
    "q"."quote_status",
    "q"."billable_guest_count" AS "billable_guests",
    "q"."package_total",
    "q"."additional_total",
    "q"."mileage_fee",
    "q"."quote_total",
    "q"."reservation_amount",
    "q"."balance_due",
    "q"."created_at",
    "c"."ab_name" AS "customer_name",
    "e"."event_name",
    "e"."event_date",
    "e"."start_time",
    "e"."end_time",
    "e"."city",
    "e"."state",
    "p"."package_name",
    "p"."package_key"
   FROM ((("public"."quotes" "q"
     LEFT JOIN "public"."customers" "c" ON (("c"."id" = "q"."customer_id")))
     LEFT JOIN "public"."packages" "p" ON (("p"."id" = "q"."package_id")))
     LEFT JOIN "public"."events" "e" ON (("e"."id" = "q"."event_id")))
  WHERE ("q"."active" IS TRUE);


ALTER VIEW "public"."quote_list_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quote_option_definitions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "option_key" character varying(100) NOT NULL,
    "label_pt" character varying(255) NOT NULL,
    "label_en" character varying(255) NOT NULL,
    "label_es" character varying(255) NOT NULL,
    "option_type" character varying(50) DEFAULT 'boolean'::character varying,
    "default_value" boolean DEFAULT false,
    "display_order" integer DEFAULT 0,
    "active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."quote_option_definitions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quote_option_values" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "quote_id" "uuid",
    "option_definition_id" "uuid",
    "boolean_value" boolean,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."quote_option_values" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quote_package_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "quote_id" "uuid" NOT NULL,
    "additional_item_id" "uuid",
    "item_key" character varying(100),
    "category_key" character varying(100),
    "label_pt" character varying(255),
    "label_en" character varying(255),
    "label_es" character varying(255),
    "pricing_type" character varying(50),
    "quantity" numeric DEFAULT 1,
    "unit_price" numeric DEFAULT 0,
    "total_price" numeric DEFAULT 0,
    "included_in_package" boolean DEFAULT true,
    "display_order" integer DEFAULT 1,
    "selected" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."quote_package_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quote_package_selections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "quote_id" "uuid" NOT NULL,
    "package_id" "uuid" NOT NULL,
    "option_group_id" "uuid" NOT NULL,
    "option_item_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "branch_id" "uuid"
);


ALTER TABLE "public"."quote_package_selections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quote_statuses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "status_key" character varying(50) NOT NULL,
    "label_pt" character varying(100) NOT NULL,
    "label_en" character varying(100) NOT NULL,
    "label_es" character varying(100) NOT NULL,
    "display_order" integer DEFAULT 1,
    "active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."quote_statuses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quote_text_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "template_key" character varying(100) NOT NULL,
    "label_pt" character varying(255),
    "label_en" character varying(255),
    "label_es" character varying(255),
    "text_pt" "text",
    "text_en" "text",
    "text_es" "text",
    "active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."quote_text_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "role_key" character varying(50) NOT NULL,
    "label_pt" character varying(100) NOT NULL,
    "label_en" character varying(100) NOT NULL,
    "label_es" character varying(100) NOT NULL,
    "min_guests" integer NOT NULL,
    "max_guests" integer NOT NULL,
    "quantity" integer NOT NULL,
    "active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."staff_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "plan_name" "text" NOT NULL,
    "monthly_price" numeric(12,2) DEFAULT 0,
    "currency" "text" DEFAULT 'USD'::"text",
    "included_branches" integer DEFAULT 1,
    "extra_branch_price" numeric(12,2) DEFAULT 0,
    "status" "text" DEFAULT 'active'::"text",
    "started_at" "date" DEFAULT CURRENT_DATE,
    "trial_ends_at" "date",
    "current_period_start" "date",
    "current_period_end" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "full_name" character varying(255),
    "email" character varying(255),
    "role" character varying(50),
    "active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."v_package_id" (
    "id" "uuid"
);


ALTER TABLE "public"."v_package_id" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_side_catalog_items" AS
 SELECT "id",
    "company_id",
    "branch_id",
    "item_key",
    "item_name",
    "label_pt",
    "label_en",
    "label_es",
    "category_key",
    "category_pt",
    "category_en",
    "category_es",
    "price",
    "sale_price",
    "cost_price",
    "currency_code",
    "charge_type",
    "pricing_type",
    "image_url",
    "image_status",
    "item_type",
    "can_be_package_item",
    "can_be_side_item",
    "can_be_additional",
    "can_be_option_choice",
    "customer_visible",
    "operational_item",
    "inventory_enabled",
    "active",
    "display_order",
    "created_at",
    "updated_at"
   FROM "public"."catalog_items"
  WHERE (("item_type" = 'SIDE'::"text") AND ("can_be_side_item" = true) AND ("customer_visible" = true));


ALTER VIEW "public"."v_side_catalog_items" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_customer_display" AS
 SELECT "id",
    "company_id",
    "ab_number",
    "ab_name",
    "ab_type",
    "phone",
    "email",
    "full_name",
    "contact_name",
    "company_name",
    "address",
    "address_line",
    "city",
    "state",
    "postal_code",
    "country",
    "customer_type",
    "address_book_role",
    "active",
    "created_at",
    "updated_at",
    NULLIF("btrim"((COALESCE("ab_name", "full_name", "contact_name", "company_name", "email", (("phone")::"text")::character varying))::"text"), ''::"text") AS "customer_display_name"
   FROM "public"."customers" "c";


ALTER VIEW "public"."vw_customer_display" OWNER TO "postgres";


COMMENT ON VIEW "public"."vw_customer_display" IS 'Nome de exibição único por cliente. Ordem: ab_name, full_name, contact_name, company_name, email, phone.';



ALTER TABLE ONLY "public"."catalog_items"
    ADD CONSTRAINT "additional_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_roles"
    ADD CONSTRAINT "app_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_users"
    ADD CONSTRAINT "app_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_company_id_slug_key" UNIQUE ("company_id", "slug");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."catalog_item_prices"
    ADD CONSTRAINT "catalog_item_prices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commercial_rules"
    ADD CONSTRAINT "commercial_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commercial_rules"
    ADD CONSTRAINT "commercial_rules_rule_key_key" UNIQUE ("rule_key");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_company_code_key" UNIQUE ("company_code");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_assets"
    ADD CONSTRAINT "company_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_features"
    ADD CONSTRAINT "company_features_company_id_feature_key_key" UNIQUE ("company_id", "feature_key");



ALTER TABLE ONLY "public"."company_features"
    ADD CONSTRAINT "company_features_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_sequences"
    ADD CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_sequences"
    ADD CONSTRAINT "document_sequences_unique" UNIQUE ("company_id", "document_type", "year");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."franchise_groups"
    ADD CONSTRAINT "franchise_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."franchise_groups"
    ADD CONSTRAINT "franchise_groups_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."languages"
    ADD CONSTRAINT "languages_language_code_key" UNIQUE ("language_code");



ALTER TABLE ONLY "public"."languages"
    ADD CONSTRAINT "languages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."media_assets"
    ADD CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."package_categories"
    ADD CONSTRAINT "package_categories_company_id_category_key_key" UNIQUE ("company_id", "category_key");



ALTER TABLE ONLY "public"."package_categories"
    ADD CONSTRAINT "package_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."package_items"
    ADD CONSTRAINT "package_items_company_package_item_key_unique" UNIQUE ("company_id", "package_id", "item_key");



ALTER TABLE ONLY "public"."package_items"
    ADD CONSTRAINT "package_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."package_option_group_items"
    ADD CONSTRAINT "package_option_group_items_group_item_key_unique" UNIQUE ("option_group_id", "option_item_key");



ALTER TABLE ONLY "public"."package_option_group_items"
    ADD CONSTRAINT "package_option_group_items_group_item_unique" UNIQUE ("option_group_id", "option_item_key");



ALTER TABLE ONLY "public"."package_option_group_items"
    ADD CONSTRAINT "package_option_group_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."package_option_groups"
    ADD CONSTRAINT "package_option_groups_company_package_group_key" UNIQUE ("company_id", "package_id", "group_key");



ALTER TABLE ONLY "public"."package_option_groups"
    ADD CONSTRAINT "package_option_groups_company_package_option_group_key" UNIQUE ("company_id", "package_id", "option_group_key");



ALTER TABLE ONLY "public"."package_option_groups"
    ADD CONSTRAINT "package_option_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."package_option_values"
    ADD CONSTRAINT "package_option_values_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."package_side_items"
    ADD CONSTRAINT "package_side_items_company_id_package_id_item_key_key" UNIQUE ("company_id", "package_id", "item_key");



ALTER TABLE ONLY "public"."package_side_items"
    ADD CONSTRAINT "package_side_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."packages"
    ADD CONSTRAINT "packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_rules"
    ADD CONSTRAINT "payment_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quote_additional_items"
    ADD CONSTRAINT "quote_additional_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quote_items"
    ADD CONSTRAINT "quote_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quote_option_definitions"
    ADD CONSTRAINT "quote_option_definitions_company_id_option_key_key" UNIQUE ("company_id", "option_key");



ALTER TABLE ONLY "public"."quote_option_definitions"
    ADD CONSTRAINT "quote_option_definitions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quote_option_selections"
    ADD CONSTRAINT "quote_option_selections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quote_option_values"
    ADD CONSTRAINT "quote_option_values_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quote_option_values"
    ADD CONSTRAINT "quote_option_values_quote_id_option_definition_id_key" UNIQUE ("quote_id", "option_definition_id");



ALTER TABLE ONLY "public"."quote_package_items"
    ADD CONSTRAINT "quote_package_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quote_package_selections"
    ADD CONSTRAINT "quote_package_selections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quote_package_selections"
    ADD CONSTRAINT "quote_package_selections_quote_option_group_unique" UNIQUE ("quote_id", "option_group_id");



ALTER TABLE ONLY "public"."quote_statuses"
    ADD CONSTRAINT "quote_statuses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quote_text_templates"
    ADD CONSTRAINT "quote_text_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_rules"
    ADD CONSTRAINT "staff_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "customers_company_phone_normalized_uidx" ON "public"."customers" USING "btree" ("company_id", "phone_normalized") WHERE (("phone_normalized" IS NOT NULL) AND ("phone_normalized" <> ''::"text") AND ("active" = true));



CREATE INDEX "document_sequences_company_type_year_idx" ON "public"."document_sequences" USING "btree" ("company_id", "document_type", "year");



CREATE INDEX "idx_additional_items_company_branch" ON "public"."catalog_items" USING "btree" ("company_id", "branch_id");



CREATE INDEX "idx_additional_items_company_id" ON "public"."catalog_items" USING "btree" ("company_id");



CREATE INDEX "idx_audit_logs_company_entity" ON "public"."audit_logs" USING "btree" ("company_id", "entity_type", "entity_id", "created_at" DESC);



CREATE INDEX "idx_branches_company" ON "public"."branches" USING "btree" ("company_id") WHERE ("active" = true);



CREATE INDEX "idx_company_features_company" ON "public"."company_features" USING "btree" ("company_id", "feature_key");



CREATE INDEX "idx_customers_company_branch" ON "public"."customers" USING "btree" ("company_id", "branch_id");



CREATE INDEX "idx_customers_company_id" ON "public"."customers" USING "btree" ("company_id");



CREATE INDEX "idx_events_company_id" ON "public"."events" USING "btree" ("company_id");



CREATE INDEX "idx_media_assets_company_entity" ON "public"."media_assets" USING "btree" ("company_id", "entity_type", "entity_key");



CREATE INDEX "idx_package_items_company_package_active" ON "public"."package_items" USING "btree" ("company_id", "package_id", "display_order") WHERE ("active" = true);



CREATE INDEX "idx_package_items_package" ON "public"."package_items" USING "btree" ("company_id", "package_id", "display_order") WHERE ("active" = true);



CREATE INDEX "idx_package_option_group_items_group" ON "public"."package_option_group_items" USING "btree" ("option_group_id", "display_order") WHERE ("active" = true);



CREATE INDEX "idx_package_option_groups_package" ON "public"."package_option_groups" USING "btree" ("company_id", "package_id", "display_order") WHERE ("active" = true);



CREATE INDEX "idx_package_side_items_package" ON "public"."package_side_items" USING "btree" ("company_id", "package_id", "display_order") WHERE ("active" = true);



CREATE INDEX "idx_packages_company_branch" ON "public"."packages" USING "btree" ("company_id", "branch_id");



CREATE INDEX "idx_packages_company_id" ON "public"."packages" USING "btree" ("company_id");



CREATE INDEX "idx_quote_package_selections_company_quote" ON "public"."quote_package_selections" USING "btree" ("company_id", "quote_id");



CREATE INDEX "idx_quote_package_selections_quote" ON "public"."quote_package_selections" USING "btree" ("quote_id");



CREATE INDEX "idx_quotes_company_branch" ON "public"."quotes" USING "btree" ("company_id", "branch_id");



CREATE INDEX "idx_quotes_company_id" ON "public"."quotes" USING "btree" ("company_id");



CREATE INDEX "idx_quotes_quote_number" ON "public"."quotes" USING "btree" ("quote_number");



CREATE INDEX "idx_subscriptions_company" ON "public"."subscriptions" USING "btree" ("company_id", "status");



CREATE UNIQUE INDEX "quotes_company_id_quote_number_unique" ON "public"."quotes" USING "btree" ("company_id", "quote_number") WHERE (("quote_number" IS NOT NULL) AND ("btrim"(("quote_number")::"text") <> ''::"text"));



CREATE UNIQUE INDEX "quotes_company_quote_number_uidx" ON "public"."quotes" USING "btree" ("company_id", "quote_number") WHERE ("quote_number" IS NOT NULL);



ALTER TABLE ONLY "public"."catalog_items"
    ADD CONSTRAINT "additional_items_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."catalog_items"
    ADD CONSTRAINT "additional_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."catalog_item_prices"
    ADD CONSTRAINT "catalog_item_prices_catalog_item_id_fkey" FOREIGN KEY ("catalog_item_id") REFERENCES "public"."catalog_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_franchise_group_id_fkey" FOREIGN KEY ("franchise_group_id") REFERENCES "public"."franchise_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_assets"
    ADD CONSTRAINT "company_assets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."company_features"
    ADD CONSTRAINT "company_features_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."package_categories"
    ADD CONSTRAINT "package_categories_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."package_items"
    ADD CONSTRAINT "package_items_additional_item_id_fkey" FOREIGN KEY ("additional_item_id") REFERENCES "public"."catalog_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."package_items"
    ADD CONSTRAINT "package_items_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."package_items"
    ADD CONSTRAINT "package_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."package_items"
    ADD CONSTRAINT "package_items_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id");



ALTER TABLE ONLY "public"."package_option_group_items"
    ADD CONSTRAINT "package_option_group_items_additional_item_id_fkey" FOREIGN KEY ("additional_item_id") REFERENCES "public"."catalog_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."package_option_group_items"
    ADD CONSTRAINT "package_option_group_items_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."package_option_group_items"
    ADD CONSTRAINT "package_option_group_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."package_option_group_items"
    ADD CONSTRAINT "package_option_group_items_option_group_id_fkey" FOREIGN KEY ("option_group_id") REFERENCES "public"."package_option_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."package_option_groups"
    ADD CONSTRAINT "package_option_groups_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."package_side_items"
    ADD CONSTRAINT "package_side_items_additional_item_id_fkey" FOREIGN KEY ("additional_item_id") REFERENCES "public"."catalog_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."package_side_items"
    ADD CONSTRAINT "package_side_items_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."package_side_items"
    ADD CONSTRAINT "package_side_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."package_side_items"
    ADD CONSTRAINT "package_side_items_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."packages"
    ADD CONSTRAINT "packages_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."packages"
    ADD CONSTRAINT "packages_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."quote_items"
    ADD CONSTRAINT "quote_items_additional_item_id_fkey" FOREIGN KEY ("additional_item_id") REFERENCES "public"."catalog_items"("id");



ALTER TABLE ONLY "public"."quote_items"
    ADD CONSTRAINT "quote_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."quote_items"
    ADD CONSTRAINT "quote_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id");



ALTER TABLE ONLY "public"."quote_option_definitions"
    ADD CONSTRAINT "quote_option_definitions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."quote_option_values"
    ADD CONSTRAINT "quote_option_values_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."quote_option_values"
    ADD CONSTRAINT "quote_option_values_option_definition_id_fkey" FOREIGN KEY ("option_definition_id") REFERENCES "public"."quote_option_definitions"("id");



ALTER TABLE ONLY "public"."quote_option_values"
    ADD CONSTRAINT "quote_option_values_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id");



ALTER TABLE ONLY "public"."quote_package_selections"
    ADD CONSTRAINT "quote_package_selections_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quote_package_selections"
    ADD CONSTRAINT "quote_package_selections_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quote_package_selections"
    ADD CONSTRAINT "quote_package_selections_option_group_id_fkey" FOREIGN KEY ("option_group_id") REFERENCES "public"."package_option_groups"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."quote_package_selections"
    ADD CONSTRAINT "quote_package_selections_option_item_id_fkey" FOREIGN KEY ("option_item_id") REFERENCES "public"."package_option_group_items"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."quote_package_selections"
    ADD CONSTRAINT "quote_package_selections_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."quote_package_selections"
    ADD CONSTRAINT "quote_package_selections_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id");



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



CREATE POLICY "Allow read package option group items" ON "public"."package_option_group_items" FOR SELECT TO "authenticated", "anon" USING (("active" = true));



CREATE POLICY "Allow read package option groups" ON "public"."package_option_groups" FOR SELECT TO "authenticated", "anon" USING (("active" = true));



CREATE POLICY "allow anon delete commercial rules" ON "public"."commercial_rules" FOR DELETE TO "anon" USING (true);



CREATE POLICY "allow anon delete quote additional items" ON "public"."quote_additional_items" FOR DELETE TO "anon" USING (true);



CREATE POLICY "allow anon insert commercial rules" ON "public"."commercial_rules" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "allow anon insert events" ON "public"."events" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "allow anon insert quote additional items" ON "public"."quote_additional_items" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "allow anon select commercial rules" ON "public"."commercial_rules" FOR SELECT TO "anon" USING (true);



CREATE POLICY "allow anon select events" ON "public"."events" FOR SELECT TO "anon" USING (true);



CREATE POLICY "allow anon select quote additional items" ON "public"."quote_additional_items" FOR SELECT TO "anon" USING (true);



CREATE POLICY "allow anon update commercial rules" ON "public"."commercial_rules" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "allow anon update events" ON "public"."events" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "allow anon update quote additional items" ON "public"."quote_additional_items" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



ALTER TABLE "public"."app_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."app_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."branches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."catalog_item_prices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commercial_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."companies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_assets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_features" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."document_sequences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."franchise_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."languages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."media_assets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."package_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."package_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."package_option_group_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."package_option_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."package_option_values" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."package_side_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quote_additional_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quote_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quote_option_definitions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quote_option_selections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quote_option_values" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quote_package_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quote_package_selections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quote_statuses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quote_text_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."v_package_id" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_next_document_number"("p_company_id" "uuid", "p_document_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_next_document_number"("p_company_id" "uuid", "p_document_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_next_document_number"("p_company_id" "uuid", "p_document_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_document_prefix"("p_document_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_document_prefix"("p_document_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_document_prefix"("p_document_type" "text") TO "service_role";



GRANT ALL ON TABLE "public"."app_roles" TO "anon";
GRANT ALL ON TABLE "public"."app_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."app_roles" TO "service_role";



GRANT ALL ON TABLE "public"."app_users" TO "anon";
GRANT ALL ON TABLE "public"."app_users" TO "authenticated";
GRANT ALL ON TABLE "public"."app_users" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."branches" TO "anon";
GRANT ALL ON TABLE "public"."branches" TO "authenticated";
GRANT ALL ON TABLE "public"."branches" TO "service_role";



GRANT ALL ON TABLE "public"."catalog_item_prices" TO "anon";
GRANT ALL ON TABLE "public"."catalog_item_prices" TO "authenticated";
GRANT ALL ON TABLE "public"."catalog_item_prices" TO "service_role";



GRANT ALL ON TABLE "public"."catalog_items" TO "anon";
GRANT ALL ON TABLE "public"."catalog_items" TO "authenticated";
GRANT ALL ON TABLE "public"."catalog_items" TO "service_role";



GRANT ALL ON TABLE "public"."commercial_rules" TO "anon";
GRANT ALL ON TABLE "public"."commercial_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."commercial_rules" TO "service_role";



GRANT ALL ON TABLE "public"."companies" TO "anon";
GRANT ALL ON TABLE "public"."companies" TO "authenticated";
GRANT ALL ON TABLE "public"."companies" TO "service_role";



GRANT ALL ON TABLE "public"."company_assets" TO "anon";
GRANT ALL ON TABLE "public"."company_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."company_assets" TO "service_role";



GRANT ALL ON TABLE "public"."company_features" TO "anon";
GRANT ALL ON TABLE "public"."company_features" TO "authenticated";
GRANT ALL ON TABLE "public"."company_features" TO "service_role";



GRANT ALL ON TABLE "public"."customers" TO "anon";
GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";



GRANT ALL ON TABLE "public"."document_sequences" TO "anon";
GRANT ALL ON TABLE "public"."document_sequences" TO "authenticated";
GRANT ALL ON TABLE "public"."document_sequences" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."franchise_groups" TO "anon";
GRANT ALL ON TABLE "public"."franchise_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."franchise_groups" TO "service_role";



GRANT ALL ON TABLE "public"."languages" TO "anon";
GRANT ALL ON TABLE "public"."languages" TO "authenticated";
GRANT ALL ON TABLE "public"."languages" TO "service_role";



GRANT ALL ON TABLE "public"."media_assets" TO "anon";
GRANT ALL ON TABLE "public"."media_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."media_assets" TO "service_role";



GRANT ALL ON TABLE "public"."package_categories" TO "anon";
GRANT ALL ON TABLE "public"."package_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."package_categories" TO "service_role";



GRANT ALL ON TABLE "public"."package_items" TO "anon";
GRANT ALL ON TABLE "public"."package_items" TO "authenticated";
GRANT ALL ON TABLE "public"."package_items" TO "service_role";



GRANT ALL ON TABLE "public"."package_option_group_items" TO "anon";
GRANT ALL ON TABLE "public"."package_option_group_items" TO "authenticated";
GRANT ALL ON TABLE "public"."package_option_group_items" TO "service_role";



GRANT ALL ON TABLE "public"."package_option_groups" TO "anon";
GRANT ALL ON TABLE "public"."package_option_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."package_option_groups" TO "service_role";



GRANT ALL ON TABLE "public"."package_option_values" TO "anon";
GRANT ALL ON TABLE "public"."package_option_values" TO "authenticated";
GRANT ALL ON TABLE "public"."package_option_values" TO "service_role";



GRANT ALL ON TABLE "public"."package_side_items" TO "anon";
GRANT ALL ON TABLE "public"."package_side_items" TO "authenticated";
GRANT ALL ON TABLE "public"."package_side_items" TO "service_role";



GRANT ALL ON TABLE "public"."packages" TO "anon";
GRANT ALL ON TABLE "public"."packages" TO "authenticated";
GRANT ALL ON TABLE "public"."packages" TO "service_role";



GRANT ALL ON TABLE "public"."payment_rules" TO "anon";
GRANT ALL ON TABLE "public"."payment_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_rules" TO "service_role";



GRANT ALL ON TABLE "public"."quote_additional_items" TO "anon";
GRANT ALL ON TABLE "public"."quote_additional_items" TO "authenticated";
GRANT ALL ON TABLE "public"."quote_additional_items" TO "service_role";



GRANT ALL ON TABLE "public"."quote_option_selections" TO "anon";
GRANT ALL ON TABLE "public"."quote_option_selections" TO "authenticated";
GRANT ALL ON TABLE "public"."quote_option_selections" TO "service_role";



GRANT ALL ON TABLE "public"."quotes" TO "anon";
GRANT ALL ON TABLE "public"."quotes" TO "authenticated";
GRANT ALL ON TABLE "public"."quotes" TO "service_role";



GRANT ALL ON TABLE "public"."quote_detail_view" TO "anon";
GRANT ALL ON TABLE "public"."quote_detail_view" TO "authenticated";
GRANT ALL ON TABLE "public"."quote_detail_view" TO "service_role";



GRANT ALL ON TABLE "public"."quote_items" TO "anon";
GRANT ALL ON TABLE "public"."quote_items" TO "authenticated";
GRANT ALL ON TABLE "public"."quote_items" TO "service_role";



GRANT ALL ON TABLE "public"."quote_list_view" TO "anon";
GRANT ALL ON TABLE "public"."quote_list_view" TO "authenticated";
GRANT ALL ON TABLE "public"."quote_list_view" TO "service_role";



GRANT ALL ON TABLE "public"."quote_option_definitions" TO "anon";
GRANT ALL ON TABLE "public"."quote_option_definitions" TO "authenticated";
GRANT ALL ON TABLE "public"."quote_option_definitions" TO "service_role";



GRANT ALL ON TABLE "public"."quote_option_values" TO "anon";
GRANT ALL ON TABLE "public"."quote_option_values" TO "authenticated";
GRANT ALL ON TABLE "public"."quote_option_values" TO "service_role";



GRANT ALL ON TABLE "public"."quote_package_items" TO "anon";
GRANT ALL ON TABLE "public"."quote_package_items" TO "authenticated";
GRANT ALL ON TABLE "public"."quote_package_items" TO "service_role";



GRANT ALL ON TABLE "public"."quote_package_selections" TO "anon";
GRANT ALL ON TABLE "public"."quote_package_selections" TO "authenticated";
GRANT ALL ON TABLE "public"."quote_package_selections" TO "service_role";



GRANT ALL ON TABLE "public"."quote_statuses" TO "anon";
GRANT ALL ON TABLE "public"."quote_statuses" TO "authenticated";
GRANT ALL ON TABLE "public"."quote_statuses" TO "service_role";



GRANT ALL ON TABLE "public"."quote_text_templates" TO "anon";
GRANT ALL ON TABLE "public"."quote_text_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."quote_text_templates" TO "service_role";



GRANT ALL ON TABLE "public"."staff_rules" TO "anon";
GRANT ALL ON TABLE "public"."staff_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_rules" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."v_package_id" TO "anon";
GRANT ALL ON TABLE "public"."v_package_id" TO "authenticated";
GRANT ALL ON TABLE "public"."v_package_id" TO "service_role";



GRANT ALL ON TABLE "public"."v_side_catalog_items" TO "anon";
GRANT ALL ON TABLE "public"."v_side_catalog_items" TO "authenticated";
GRANT ALL ON TABLE "public"."v_side_catalog_items" TO "service_role";



GRANT ALL ON TABLE "public"."vw_customer_display" TO "anon";
GRANT ALL ON TABLE "public"."vw_customer_display" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_customer_display" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







