-- Script para solucionar el error de "numeric field overflow" en montos altos (ej. Pesos Colombianos)

-- 1. Tabla de Pagos
ALTER TABLE IF EXISTS public.payments ALTER COLUMN amount TYPE numeric;

-- 2. Tabla de Órdenes
ALTER TABLE IF EXISTS public.orders ALTER COLUMN total_amount TYPE numeric;
ALTER TABLE IF EXISTS public.orders ALTER COLUMN tip_amount TYPE numeric;
ALTER TABLE IF EXISTS public.orders ALTER COLUMN delivery_fee TYPE numeric;

-- 3. Tabla de Arqueos de Caja (Cash Registers)
ALTER TABLE IF EXISTS public.cash_registers ALTER COLUMN start_amount TYPE numeric;
ALTER TABLE IF EXISTS public.cash_registers ALTER COLUMN total_sold TYPE numeric;
ALTER TABLE IF EXISTS public.cash_registers ALTER COLUMN total_withdrawn TYPE numeric;
ALTER TABLE IF EXISTS public.cash_registers ALTER COLUMN end_amount TYPE numeric;
ALTER TABLE IF EXISTS public.cash_registers ALTER COLUMN difference TYPE numeric;

-- 4. Tabla de Gastos
ALTER TABLE IF EXISTS public.expenses ALTER COLUMN amount TYPE numeric;

-- 5. Tabla de Productos y modificadores
ALTER TABLE IF EXISTS public.products ALTER COLUMN price TYPE numeric;
ALTER TABLE IF EXISTS public.products ALTER COLUMN cost TYPE numeric;
ALTER TABLE IF EXISTS public.order_items ALTER COLUMN unit_price TYPE numeric;
ALTER TABLE IF EXISTS public.modifier_options ALTER COLUMN price_extra TYPE numeric;
