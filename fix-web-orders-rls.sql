-- SQL for Supabase SQL Editor to allow public web orders.

-- Allow anonymous inserts to orders
CREATE POLICY "Permitir crear pedidos web a usuarios anonimos" 
ON public.orders 
FOR INSERT 
TO public 
WITH CHECK (true);

-- Allow anonymous inserts to order_items
CREATE POLICY "Permitir crear productos en pedidos a usuarios anonimos" 
ON public.order_items 
FOR INSERT 
TO public 
WITH CHECK (true);
