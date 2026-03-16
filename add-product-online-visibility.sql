-- Añadir columna is_visible_online a los productos
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS is_visible_online BOOLEAN DEFAULT true;
