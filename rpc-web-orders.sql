-- SQL Script for Supabase SQL Editor
-- This creates a stored procedure to securely insert an order and its items from the web client, bypassing RLS.

-- 1. Create a custom type for the order items to pass them as an array
DO $$ BEGIN
    CREATE TYPE json_order_item AS (
        product_id UUID,
        quantity INTEGER,
        unit_price NUMERIC,
        notes TEXT,
        status TEXT
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create the RPC function defined as SECURITY DEFINER
-- This means it executes with the privileges of the creator (postgres/admin), allowing it to bypass RLS.
CREATE OR REPLACE FUNCTION create_web_order(
    p_client_name TEXT,
    p_delivery_phone TEXT,
    p_delivery_address TEXT,
    p_delivery_fee NUMERIC,
    p_type TEXT,
    p_total_amount NUMERIC,
    p_payment_method TEXT,
    p_general_notes TEXT,
    p_items JSONB
) RETURNS JSON AS $$
DECLARE
    v_order_id UUID;
    v_order_number INTEGER;
    v_item JSONB;
BEGIN
    -- Insert the main order
    INSERT INTO public.orders (
        client_name,
        delivery_phone,
        delivery_address,
        delivery_fee,
        status,
        type,
        total_amount,
        tip_amount,
        payment_method,
        general_notes
    ) VALUES (
        p_client_name,
        p_delivery_phone,
        p_delivery_address,
        p_delivery_fee,
        'pendiente_online',
        p_type,
        p_total_amount,
        0,
        p_payment_method,
        p_general_notes
    ) RETURNING id, order_number INTO v_order_id, v_order_number;

    -- Insert the order items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.order_items (
            order_id,
            product_id,
            quantity,
            unit_price,
            notes,
            status
        ) VALUES (
            v_order_id,
            (v_item->>'product_id')::UUID,
            (v_item->>'quantity')::INTEGER,
            (v_item->>'unit_price')::NUMERIC,
            v_item->>'notes',
            v_item->>'status'
        );
    END LOOP;

    -- Return the created order id and number
    RETURN json_build_object('id', v_order_id, 'order_number', v_order_number);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
