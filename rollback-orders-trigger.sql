-- 1. Eliminar el gatillo roto de la tabla Orders
DROP TRIGGER IF EXISTS on_order_closed_income ON public.orders;
DROP FUNCTION IF EXISTS public.update_cash_register_from_orders();
