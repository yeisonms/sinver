-- =========================================================================================
-- SCRIPT DE PROCEDIMIENTO ALMACENADO PARA DIVIDIR CUENTAS (SPLIT BILL)
-- =========================================================================================
-- Descripción:
-- Extrae productos específicos de un pedido "Padre" (Order A) y los mueve de forma segura
-- a un pedido "Hijo" (Order B) clonado en la misma mesa.
--
-- Ejecuta esto en el "SQL Editor" de Supabase
-- =========================================================================================

CREATE OR REPLACE FUNCTION split_order_items(
  original_order_id UUID,
  split_items JSONB -- Formato esperado: [{"order_item_id": "uuid", "split_qty": 2}]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
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
        v_new_order_id, v_product_id, v_split_qty, v_unit_price, v_notes, 'entregado'
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
