-- Permitir que cualquier usuario autenticado (cajero, administrador, mesero) actualice los artículos de los pedidos
-- Esto soluciona el problema de "Cannot coerce the result to a single JSON object" al intentar cancelar un producto.

DO $$ 
BEGIN
  -- Intentar crear la política para que no bloquee las actualizaciones de los productos (ej. cambiar status a 'cancelado')
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'order_items' 
    AND policyname = 'Permitir UPDATE autenticado a order_items'
  ) THEN
    CREATE POLICY "Permitir UPDATE autenticado a order_items" 
    ON public.order_items FOR UPDATE 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);
  END IF;
END $$;
