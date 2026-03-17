-- CREAR LA TABLA PARA ENVIAR IMPRESIONES DESDE EL CELULAR AL PC

CREATE TABLE IF NOT EXISTS public.print_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    payload JSONB NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Permisos RLS para que cualquier celular pueda enviar el ticket
ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir todo a usuarios en print_jobs" ON public.print_jobs;
CREATE POLICY "Permitir todo a usuarios en print_jobs" 
ON public.print_jobs 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- ¡EL PASO ESTRELLA! Encender la transmisión de Eventos en Tiempo Real (Realtime)
-- Para que el PC del Cajero reciba la notificación al instante
ALTER PUBLICATION supabase_realtime ADD TABLE public.print_jobs;
