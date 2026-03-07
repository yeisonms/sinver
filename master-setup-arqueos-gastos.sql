-- ======================================================================================
-- SCRIPT MAESTRO: INSTALAR MÓDULO DE GASTOS Y ARQUEOS EN LA NUEVA BASE DE DATOS
-- ======================================================================================

-- 1. CREACIÓN DE TABLAS DE GASTOS
CREATE TABLE IF NOT EXISTS public.expense_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    amount NUMERIC NOT NULL,
    category_id UUID REFERENCES public.expense_categories(id) ON DELETE CASCADE NOT NULL,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    provider TEXT,
    payment_method TEXT,
    receipt_type TEXT,
    notes TEXT,
    cash_register_id UUID REFERENCES public.cash_registers(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 2. HABILITAR SEGURIDAD (RLS) PARA GASTOS
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir todo a usuarios en expense_categories" ON public.expense_categories;
CREATE POLICY "Permitir todo a usuarios en expense_categories" ON public.expense_categories FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir todo a usuarios en expenses" ON public.expenses;
CREATE POLICY "Permitir todo a usuarios en expenses" ON public.expenses FOR ALL USING (true) WITH CHECK (true);

-- Insertar categorías por defecto si no existen
INSERT INTO public.expense_categories (name) 
VALUES ('Nómina'), ('Servicios'), ('Proveedores'), ('Insumos'), ('Mantenimiento'), ('Otros')
ON CONFLICT DO NOTHING;

-- 3. GATILLO: RESTAR GASTOS A LA CAJA REGISTRADORA (EGRESOS)
CREATE OR REPLACE FUNCTION public.update_cash_register_expenses()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.cash_register_id IS NOT NULL THEN
    UPDATE public.cash_registers 
    SET total_withdrawn = COALESCE(total_withdrawn, 0) + NEW.amount 
    WHERE id = NEW.cash_register_id;
  ELSIF TG_OP = 'DELETE' AND OLD.cash_register_id IS NOT NULL THEN
    UPDATE public.cash_registers 
    SET total_withdrawn = COALESCE(total_withdrawn, 0) - OLD.amount 
    WHERE id = OLD.cash_register_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_expense_changed ON public.expenses;
CREATE TRIGGER on_expense_changed
AFTER INSERT OR DELETE ON public.expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_cash_register_expenses();


-- 4. REPARAR PERMISOS RLS EN PAGOS (INGRESOS DE VENTAS)
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a usuarios en payments" ON public.payments;

CREATE POLICY "Permitir todo a usuarios en payments" 
ON public.payments 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- 5. GATILLO: SUMAR PAGOS A LA CAJA REGISTRADORA (INGRESOS)
-- Nota: Solo para la base de datos "nueva" que viene limpia de Lovable y perdió este trigger.
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
