-- Restaurar políticas RLS para la tabla de Pagos (Ingresos)
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a usuarios en payments" ON public.payments;

CREATE POLICY "Permitir todo a usuarios en payments" 
ON public.payments 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Confirmar si existía el Trigger y volver a crearlo si la BD es la antigua
CREATE OR REPLACE FUNCTION public.update_cash_register_income()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.cash_register_id IS NOT NULL THEN
    UPDATE public.cash_registers 
    SET total_sold = COALESCE(total_sold, 0) + NEW.amount 
    WHERE id = NEW.cash_register_id;
  ELSIF TG_OP = 'DELETE' AND OLD.cash_register_id IS NOT NULL THEN
    UPDATE public.cash_registers 
    SET total_sold = COALESCE(total_sold, 0) - OLD.amount 
    WHERE id = OLD.cash_register_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_payment_changed ON public.payments;
CREATE TRIGGER on_payment_changed
AFTER INSERT OR DELETE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.update_cash_register_income();
