-- Trigger alternativo: Sumar a la caja cuando la ORDEN se cierra, en lugar de depender de pagos
CREATE OR REPLACE FUNCTION public.update_cash_register_from_orders()
RETURNS trigger AS $$
BEGIN
  -- Solo actuar si la orden pasa de cualquier estado a 'cerrado' y tiene una caja asignada
  IF TG_OP = 'UPDATE' AND NEW.status = 'cerrado' AND OLD.status != 'cerrado' AND NEW.cash_register_id IS NOT NULL THEN
    UPDATE public.cash_registers 
    SET total_sold = COALESCE(total_sold, 0) + NEW.total_amount 
    WHERE id = NEW.cash_register_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_order_closed_income ON public.orders;
CREATE TRIGGER on_order_closed_income
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_cash_register_from_orders();
