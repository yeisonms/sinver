-- ELIMINAR EL TRIGGER REDUNDANTE QUE DUPLICA LOS INGRESOS
DROP TRIGGER IF EXISTS on_payment_changed ON public.payments;
DROP FUNCTION IF EXISTS public.update_cash_register_income();
