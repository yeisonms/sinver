-- Este script añade la columna 'difference' a la tabla 'cash_registers'
-- Esto soluciona el error en producción: "Could not find the 'difference' column of 'cash_registers'"

DO $$ 
BEGIN
  -- 1. Añadir la columna de diferencia si no existe
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'cash_registers' 
    AND column_name = 'difference'
  ) THEN
    ALTER TABLE public.cash_registers ADD COLUMN difference NUMERIC DEFAULT 0;
  END IF;

END $$;

-- 2. Recargar la caché de PostgREST para que la API de Supabase detecte la nueva columna inmediatamente
NOTIFY pgrst, 'reload schema';
