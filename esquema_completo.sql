


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


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."json_order_item" AS (
	"product_id" "uuid",
	"quantity" integer,
	"unit_price" numeric,
	"notes" "text",
	"status" "text"
);


ALTER TYPE "public"."json_order_item" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_web_order"("p_client_name" "text", "p_delivery_phone" "text", "p_delivery_address" "text", "p_delivery_fee" numeric, "p_type" "text", "p_total_amount" numeric, "p_payment_method" "text", "p_general_notes" "text", "p_items" "jsonb") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_order_id UUID; v_order_number INTEGER; v_item JSONB;
BEGIN
    INSERT INTO public.orders (client_name, delivery_phone, delivery_address, delivery_fee, status, type, total_amount, tip_amount, payment_method, general_notes)
    VALUES (p_client_name, p_delivery_phone, p_delivery_address, p_delivery_fee, 'pendiente_online', p_type, p_total_amount, 0, p_payment_method, p_general_notes)
    RETURNING id, order_number INTO v_order_id, v_order_number;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, notes, status)
        VALUES (v_order_id, (v_item->>'product_id')::UUID, (v_item->>'quantity')::INTEGER, (v_item->>'unit_price')::NUMERIC, v_item->>'notes', v_item->>'status');
    END LOOP;

    RETURN json_build_object('id', v_order_id, 'order_number', v_order_number);
END;
$$;


ALTER FUNCTION "public"."create_web_order"("p_client_name" "text", "p_delivery_phone" "text", "p_delivery_address" "text", "p_delivery_fee" numeric, "p_type" "text", "p_total_amount" numeric, "p_payment_method" "text", "p_general_notes" "text", "p_items" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_admin_users"() RETURNS TABLE("id" "uuid", "email" character varying, "full_name" "text", "role" "text", "is_active" boolean, "last_sign_in_at" timestamp with time zone, "created_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    SELECT 
        p.id,
        u.email::varchar,
        p.full_name,
        p.role,
        p.is_active,
        u.last_sign_in_at,
        p.created_at
    FROM profiles p
    JOIN auth.users u ON p.id = u.id
    ORDER BY p.full_name ASC;
$$;


ALTER FUNCTION "public"."get_admin_users"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, is_active)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', -- Toma el nombre del registro
    'mesero', -- Rol por defecto (seguridad)
    false     -- ¡IMPORTANTE! Inactivo por defecto para que no pueda entrar
  );
  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."split_order_items"("original_order_id" "uuid", "split_items" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_new_order_id UUID;
  v_table_id UUID;
  v_waiter_id UUID;
  v_customer_id UUID;
  v_client_name TEXT;
  v_type TEXT;
  v_item JSONB;
  v_item_id UUID;
  v_split_qty INT;
  v_current_qty INT;
  v_unit_price NUMERIC;
  v_product_id UUID;
  v_notes TEXT;
  
  v_sum_original NUMERIC := 0;
  v_sum_new NUMERIC := 0;
BEGIN
  -- 1. Obtener la metadata del pedido original (Padre)
  SELECT table_id, waiter_id, customer_id, client_name, type
  INTO v_table_id, v_waiter_id, v_customer_id, v_client_name, v_type
  FROM public.orders
  WHERE id = original_order_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido original no encontrado';
  END IF;

  -- 2. Crear el nuevo pedido (Hijo)
  INSERT INTO public.orders (
    table_id,
    waiter_id,
    customer_id,
    client_name,
    status,
    type,
    total_amount,
    tip_amount
  ) VALUES (
    v_table_id,
    v_waiter_id,
    v_customer_id,
    v_client_name || ' (Dividida)',
    'pendiente', -- El nuevo pedido nace pendiente de pago
    v_type,
    0, -- Se recalcula al final
    0
  ) RETURNING id INTO v_new_order_id;

  -- 3. Procesar cada item solicitado en el JSON
  FOR v_item IN SELECT * FROM jsonb_array_elements(split_items)
  LOOP
    v_item_id := (v_item->>'order_item_id')::UUID;
    v_split_qty := (v_item->>'split_qty')::INT;
    
    IF v_split_qty <= 0 THEN
      CONTINUE; -- Ignorar cantidades cero o negativas
    END IF;

    -- Obtener datos físicos del item original
    SELECT quantity, unit_price, product_id, notes
    INTO v_current_qty, v_unit_price, v_product_id, v_notes
    FROM public.order_items
    WHERE id = v_item_id AND order_id = original_order_id AND status != 'cancelado';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Item % no encontrado o ya fue cancelado', v_item_id;
    END IF;

    IF v_split_qty > v_current_qty THEN
      RAISE EXCEPTION 'No puedes separar más cantidad de la que existe en el pedido';
    END IF;

    IF v_split_qty = v_current_qty THEN
      -- Transferencia Total: Mover el item completo al nuevo pedido
      UPDATE public.order_items
      SET order_id = v_new_order_id
      WHERE id = v_item_id;
    ELSE
      -- Transferencia Parcial: Restar al original y crear un clon en el nuevo pedido
      UPDATE public.order_items
      SET quantity = quantity - v_split_qty
      WHERE id = v_item_id;
      
      INSERT INTO public.order_items (
        order_id, product_id, quantity, unit_price, notes, status
      ) VALUES (
        v_new_order_id, v_product_id, v_split_qty, v_unit_price, v_notes, 'activo'
      );
    END IF;
  END LOOP;

  -- 4. Recalcular y actualizar los Totales de ambos pedidos (A y B)
  -- Suma Padre (A)
  SELECT COALESCE(SUM(quantity * unit_price), 0) INTO v_sum_original
  FROM public.order_items
  WHERE order_id = original_order_id AND status != 'cancelado';

  -- Suma Hijo (B)
  SELECT COALESCE(SUM(quantity * unit_price), 0) INTO v_sum_new
  FROM public.order_items
  WHERE order_id = v_new_order_id AND status != 'cancelado';

  UPDATE public.orders SET total_amount = v_sum_original WHERE id = original_order_id;
  UPDATE public.orders SET total_amount = v_sum_new WHERE id = v_new_order_id;

  -- 5. Devolver el ID del nuevo pedido para inyectarlo en el Cajero (CheckoutDialog)
  RETURN v_new_order_id;

END;
$$;


ALTER FUNCTION "public"."split_order_items"("original_order_id" "uuid", "split_items" "jsonb") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."areas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT true
);


ALTER TABLE "public"."areas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cash_registers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "opened_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "closed_at" timestamp with time zone,
    "start_amount" numeric(10,2) DEFAULT 0,
    "end_amount" numeric(10,2),
    "status" "text" DEFAULT 'open'::"text",
    "opened_by" "uuid",
    "total_sold" numeric(10,2) DEFAULT 0,
    "total_withdrawn" numeric(10,2) DEFAULT 0,
    CONSTRAINT "cash_registers_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."cash_registers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "sort_order" integer DEFAULT 0,
    "is_visible_online" boolean DEFAULT true,
    "show_in_app" boolean DEFAULT true,
    "show_in_store" boolean DEFAULT true,
    "show_in_qr" boolean DEFAULT true
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."category_printers" (
    "category_id" "uuid" NOT NULL,
    "printer_id" "uuid" NOT NULL
);


ALTER TABLE "public"."category_printers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."modifier_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "min_selection" integer DEFAULT 0,
    "max_selection" integer DEFAULT 1,
    "public_name" "text",
    "price_logic" "text" DEFAULT 'sum'::"text",
    CONSTRAINT "modifier_groups_price_logic_check" CHECK (("price_logic" = ANY (ARRAY['sum'::"text", 'max'::"text", 'average'::"text"])))
);


ALTER TABLE "public"."modifier_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."modifier_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid",
    "name" "text" NOT NULL,
    "price_extra" numeric(10,2) DEFAULT 0
);


ALTER TABLE "public"."modifier_options" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_item_modifiers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_item_id" "uuid",
    "modifier_option_id" "uuid",
    "price_extra" numeric(10,2) DEFAULT 0
);


ALTER TABLE "public"."order_item_modifiers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid",
    "product_id" "uuid",
    "quantity" integer DEFAULT 1,
    "unit_price" numeric(10,2) NOT NULL,
    "notes" "text",
    "status" "text" DEFAULT 'pendiente'::"text",
    "cancellation_reason" "text",
    CONSTRAINT "order_items_status_check" CHECK (("status" = ANY (ARRAY['activo'::"text", 'cancelado'::"text"])))
);


ALTER TABLE "public"."order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_number" integer NOT NULL,
    "table_id" "uuid",
    "status" "text" DEFAULT 'pendiente'::"text",
    "type" "text" DEFAULT 'mesa'::"text",
    "waiter_id" "uuid",
    "total_amount" numeric(10,2) DEFAULT 0,
    "tip_amount" numeric(10,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "client_name" "text",
    "general_notes" "text",
    "customer_id" "uuid",
    "diner_count" integer DEFAULT 1,
    "closed_at" timestamp with time zone,
    "invoice_status" "text" DEFAULT 'no_facturado'::"text",
    "payment_method" "text",
    "delivery_address" "text",
    "delivery_fee" numeric(10,2) DEFAULT 0,
    "delivery_phone" "text",
    "rejection_reason" "text",
    "client_email" "text",
    "estimated_time" integer,
    CONSTRAINT "orders_status_check" CHECK (("status" = ANY (ARRAY['pendiente'::"text", 'pendiente_online'::"text", 'en_preparacion'::"text", 'listo'::"text", 'entregado'::"text", 'cerrado'::"text", 'cancelado'::"text", 'rechazado'::"text"]))),
    CONSTRAINT "orders_type_check" CHECK (("type" = ANY (ARRAY['mesa'::"text", 'domicilio'::"text", 'recoger'::"text"])))
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."orders_order_number_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."orders_order_number_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."orders_order_number_seq" OWNED BY "public"."orders"."order_number";



CREATE TABLE IF NOT EXISTS "public"."payment_methods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."payment_methods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid",
    "cash_register_id" "uuid",
    "amount" numeric(10,2) NOT NULL,
    "method" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."printers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "ip_address" "text",
    "is_active" boolean DEFAULT true,
    "port" integer DEFAULT 9100
);


ALTER TABLE "public"."printers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_modifiers" (
    "product_id" "uuid" NOT NULL,
    "group_id" "uuid" NOT NULL
);


ALTER TABLE "public"."product_modifiers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric(10,2) NOT NULL,
    "cost" numeric(10,2) DEFAULT 0,
    "category_id" "uuid",
    "image_url" "text",
    "is_available" boolean DEFAULT true,
    "is_tax_included" boolean DEFAULT true,
    "is_favorite" boolean DEFAULT false
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "role" "text" DEFAULT 'mesero'::"text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "is_active" boolean DEFAULT true,
    "phone" "text",
    "last_login" timestamp with time zone,
    "email" "text",
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'subadmin'::"text", 'mesero'::"text", 'domiciliario'::"text", 'cajero'::"text", 'cocina'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurant_info" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "address" "text",
    "phone" "text",
    "tax_id" "text",
    "printer_ip" "text" DEFAULT '192.168.1.200'::"text",
    "logo_url" "text",
    "description" "text",
    "whatsapp_number" "text",
    "facebook_url" "text",
    "instagram_url" "text",
    "banner_url" "text",
    "enable_pickup" boolean DEFAULT true,
    "enable_delivery" boolean DEFAULT true,
    "opening_hours" "jsonb" DEFAULT '{}'::"jsonb",
    "whatsapp" "text",
    "default_delivery_fee" numeric DEFAULT 0,
    "default_tip_percentage" numeric DEFAULT 10,
    "restaurant_name" "text" DEFAULT 'LA SINVERGUENCERIA BURGUER'::"text",
    "nit" "text" DEFAULT 'NIT 000000000-0'::"text",
    "tax_regime" "text" DEFAULT 'Regimen Comun'::"text",
    "pos_resolution" "text" DEFAULT 'Resolucion Facturacion POS'::"text",
    "slogan" "text" DEFAULT 'los mejores productos al carbon'::"text",
    "footer_message" "text" DEFAULT 'GRACIAS POR SU COMPRA\nBUEN PROVECHO\nBENDICIONES'::"text",
    "email" "text"
);


ALTER TABLE "public"."restaurant_info" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "role" "text" NOT NULL,
    "permission" "text" NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."role_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tables" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "area_id" "uuid",
    "capacity" integer DEFAULT 4,
    "status" "text" DEFAULT 'libre'::"text",
    "x_position" integer DEFAULT 0,
    "y_position" integer DEFAULT 0,
    "shape" "text" DEFAULT 'square'::"text",
    "size_label" "text" DEFAULT 'small'::"text",
    "is_active" boolean DEFAULT true,
    "current_order_id" "uuid",
    "current_waiter_id" "uuid",
    "printed_control" boolean DEFAULT false,
    CONSTRAINT "tables_shape_check" CHECK (("shape" = ANY (ARRAY['square'::"text", 'round'::"text"]))),
    CONSTRAINT "tables_size_label_check" CHECK (("size_label" = ANY (ARRAY['small'::"text", 'medium'::"text", 'large'::"text"]))),
    CONSTRAINT "tables_status_check" CHECK (("status" = ANY (ARRAY['libre'::"text", 'ocupada'::"text", 'reservada'::"text"])))
);


ALTER TABLE "public"."tables" OWNER TO "postgres";


ALTER TABLE ONLY "public"."orders" ALTER COLUMN "order_number" SET DEFAULT "nextval"('"public"."orders_order_number_seq"'::"regclass");



ALTER TABLE ONLY "public"."areas"
    ADD CONSTRAINT "areas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cash_registers"
    ADD CONSTRAINT "cash_registers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."category_printers"
    ADD CONSTRAINT "category_printers_pkey" PRIMARY KEY ("category_id", "printer_id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."modifier_groups"
    ADD CONSTRAINT "modifier_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."modifier_options"
    ADD CONSTRAINT "modifier_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_item_modifiers"
    ADD CONSTRAINT "order_item_modifiers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_methods"
    ADD CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."printers"
    ADD CONSTRAINT "printers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_modifiers"
    ADD CONSTRAINT "product_modifiers_pkey" PRIMARY KEY ("product_id", "group_id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurant_info"
    ADD CONSTRAINT "restaurant_info_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_permission_key" UNIQUE ("role", "permission");



ALTER TABLE ONLY "public"."tables"
    ADD CONSTRAINT "tables_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_cash_registers_opened_at" ON "public"."cash_registers" USING "btree" ("opened_at");



CREATE INDEX "idx_orders_created_at" ON "public"."orders" USING "btree" ("created_at");



CREATE INDEX "idx_orders_status" ON "public"."orders" USING "btree" ("status");



CREATE INDEX "idx_orders_waiter" ON "public"."orders" USING "btree" ("waiter_id");



ALTER TABLE ONLY "public"."cash_registers"
    ADD CONSTRAINT "cash_registers_opened_by_fkey" FOREIGN KEY ("opened_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."category_printers"
    ADD CONSTRAINT "category_printers_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."category_printers"
    ADD CONSTRAINT "category_printers_printer_id_fkey" FOREIGN KEY ("printer_id") REFERENCES "public"."printers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."modifier_options"
    ADD CONSTRAINT "modifier_options_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."modifier_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_item_modifiers"
    ADD CONSTRAINT "order_item_modifiers_modifier_option_id_fkey" FOREIGN KEY ("modifier_option_id") REFERENCES "public"."modifier_options"("id");



ALTER TABLE ONLY "public"."order_item_modifiers"
    ADD CONSTRAINT "order_item_modifiers_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_waiter_id_fkey" FOREIGN KEY ("waiter_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_cash_register_id_fkey" FOREIGN KEY ("cash_register_id") REFERENCES "public"."cash_registers"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."product_modifiers"
    ADD CONSTRAINT "product_modifiers_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."modifier_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_modifiers"
    ADD CONSTRAINT "product_modifiers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."tables"
    ADD CONSTRAINT "tables_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id");



ALTER TABLE ONLY "public"."tables"
    ADD CONSTRAINT "tables_current_order_id_fkey" FOREIGN KEY ("current_order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."tables"
    ADD CONSTRAINT "tables_current_waiter_id_fkey" FOREIGN KEY ("current_waiter_id") REFERENCES "public"."profiles"("id");



CREATE POLICY "Admin Read All Orders" ON "public"."orders" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Admin Read All Registers" ON "public"."cash_registers" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Admin Update Profiles" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((( SELECT "profiles_1"."role"
   FROM "public"."profiles" "profiles_1"
  WHERE ("profiles_1"."id" = "auth"."uid"())) = 'admin'::"text")) WITH CHECK ((( SELECT "profiles_1"."role"
   FROM "public"."profiles" "profiles_1"
  WHERE ("profiles_1"."id" = "auth"."uid"())) = 'admin'::"text"));



CREATE POLICY "Admins can manage permissions" ON "public"."role_permissions" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated delete on areas" ON "public"."areas" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated delete on tables" ON "public"."tables" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated insert on areas" ON "public"."areas" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated insert on payments" ON "public"."payments" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated insert on tables" ON "public"."tables" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated insert order_items" ON "public"."order_items" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated insert orders" ON "public"."orders" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated select on areas" ON "public"."areas" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated select on payments" ON "public"."payments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated select on tables" ON "public"."tables" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated select order_items" ON "public"."order_items" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated select orders" ON "public"."orders" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated update on areas" ON "public"."areas" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated update on tables" ON "public"."tables" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated users to update orders" ON "public"."orders" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated users to update printers" ON "public"."printers" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Auth Manage CatPrinters" ON "public"."category_printers" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Auth Manage Categories" ON "public"."categories" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Auth Manage Customers" ON "public"."customers" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Auth Manage Modifier Groups" ON "public"."modifier_groups" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Auth Manage Modifier Options" ON "public"."modifier_options" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Auth Manage Product Modifiers" ON "public"."product_modifiers" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Auth Manage Products" ON "public"."products" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated can insert restaurant_info" ON "public"."restaurant_info" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated can read restaurant_info" ON "public"."restaurant_info" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated can update restaurant_info" ON "public"."restaurant_info" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can delete cash_registers" ON "public"."cash_registers" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can insert cash_registers" ON "public"."cash_registers" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert order_items" ON "public"."order_items" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert orders" ON "public"."orders" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can read permissions" ON "public"."role_permissions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can select cash_registers" ON "public"."cash_registers" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can update cash_registers" ON "public"."cash_registers" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Manage Categories" ON "public"."categories" USING (true) WITH CHECK (true);



CREATE POLICY "Manage Category Printers" ON "public"."category_printers" USING (true) WITH CHECK (true);



CREATE POLICY "Permitir gestion total de impresoras" ON "public"."printers" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Permitir_items_publicos" ON "public"."order_items" FOR INSERT WITH CHECK (true);



CREATE POLICY "Permitir_pedidos_publicos" ON "public"."orders" FOR INSERT WITH CHECK (true);



CREATE POLICY "Public Access" ON "public"."products" FOR SELECT USING (true);



CREATE POLICY "Public Access Categories" ON "public"."categories" FOR SELECT USING (true);



CREATE POLICY "Public Create ItemModifiers" ON "public"."order_item_modifiers" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Public Create OrderItems" ON "public"."order_items" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Public Create Orders" ON "public"."orders" FOR INSERT TO "anon" WITH CHECK (("status" = 'pendiente_online'::"text"));



CREATE POLICY "Public Printers Read" ON "public"."printers" FOR SELECT USING (true);



CREATE POLICY "Public Read Categories" ON "public"."categories" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Public Read Info" ON "public"."restaurant_info" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Public Read ModOptions" ON "public"."modifier_options" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Public Read Modifiers" ON "public"."modifier_groups" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Public Read ProdModifiers" ON "public"."product_modifiers" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Public Read Products" ON "public"."products" FOR SELECT TO "anon" USING (("is_available" = true));



CREATE POLICY "Read Own Profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Read Profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Solo administradores gestionan métodos de pago" ON "public"."payment_methods" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."role" = 'admin'::"text") OR ("profiles"."role" = 'cajero'::"text")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."role" = 'admin'::"text") OR ("profiles"."role" = 'cajero'::"text"))))));



CREATE POLICY "Staff Create OrderItems" ON "public"."order_items" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Staff Create Orders" ON "public"."orders" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Staff Read OrderItems" ON "public"."order_items" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Staff Read Products" ON "public"."products" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Staff Update Tables" ON "public"."tables" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Todos pueden leer los métodos de pago" ON "public"."payment_methods" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Update Own Profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



ALTER TABLE "public"."areas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cash_registers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."category_printers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."modifier_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."modifier_options" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_item_modifiers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_methods" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."printers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_modifiers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."restaurant_info" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."role_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tables" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."create_web_order"("p_client_name" "text", "p_delivery_phone" "text", "p_delivery_address" "text", "p_delivery_fee" numeric, "p_type" "text", "p_total_amount" numeric, "p_payment_method" "text", "p_general_notes" "text", "p_items" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_web_order"("p_client_name" "text", "p_delivery_phone" "text", "p_delivery_address" "text", "p_delivery_fee" numeric, "p_type" "text", "p_total_amount" numeric, "p_payment_method" "text", "p_general_notes" "text", "p_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_web_order"("p_client_name" "text", "p_delivery_phone" "text", "p_delivery_address" "text", "p_delivery_fee" numeric, "p_type" "text", "p_total_amount" numeric, "p_payment_method" "text", "p_general_notes" "text", "p_items" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_admin_users"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_admin_users"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_admin_users"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."split_order_items"("original_order_id" "uuid", "split_items" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."split_order_items"("original_order_id" "uuid", "split_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."split_order_items"("original_order_id" "uuid", "split_items" "jsonb") TO "service_role";


















GRANT ALL ON TABLE "public"."areas" TO "anon";
GRANT ALL ON TABLE "public"."areas" TO "authenticated";
GRANT ALL ON TABLE "public"."areas" TO "service_role";



GRANT ALL ON TABLE "public"."cash_registers" TO "anon";
GRANT ALL ON TABLE "public"."cash_registers" TO "authenticated";
GRANT ALL ON TABLE "public"."cash_registers" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."category_printers" TO "anon";
GRANT ALL ON TABLE "public"."category_printers" TO "authenticated";
GRANT ALL ON TABLE "public"."category_printers" TO "service_role";



GRANT ALL ON TABLE "public"."customers" TO "anon";
GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";



GRANT ALL ON TABLE "public"."modifier_groups" TO "anon";
GRANT ALL ON TABLE "public"."modifier_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."modifier_groups" TO "service_role";



GRANT ALL ON TABLE "public"."modifier_options" TO "anon";
GRANT ALL ON TABLE "public"."modifier_options" TO "authenticated";
GRANT ALL ON TABLE "public"."modifier_options" TO "service_role";



GRANT ALL ON TABLE "public"."order_item_modifiers" TO "anon";
GRANT ALL ON TABLE "public"."order_item_modifiers" TO "authenticated";
GRANT ALL ON TABLE "public"."order_item_modifiers" TO "service_role";



GRANT ALL ON TABLE "public"."order_items" TO "anon";
GRANT ALL ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON SEQUENCE "public"."orders_order_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."orders_order_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."orders_order_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."payment_methods" TO "anon";
GRANT ALL ON TABLE "public"."payment_methods" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_methods" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."printers" TO "anon";
GRANT ALL ON TABLE "public"."printers" TO "authenticated";
GRANT ALL ON TABLE "public"."printers" TO "service_role";



GRANT ALL ON TABLE "public"."product_modifiers" TO "anon";
GRANT ALL ON TABLE "public"."product_modifiers" TO "authenticated";
GRANT ALL ON TABLE "public"."product_modifiers" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."restaurant_info" TO "anon";
GRANT ALL ON TABLE "public"."restaurant_info" TO "authenticated";
GRANT ALL ON TABLE "public"."restaurant_info" TO "service_role";



GRANT ALL ON TABLE "public"."role_permissions" TO "anon";
GRANT ALL ON TABLE "public"."role_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."role_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."tables" TO "anon";
GRANT ALL ON TABLE "public"."tables" TO "authenticated";
GRANT ALL ON TABLE "public"."tables" TO "service_role";









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



































