-- =========================================================================================
-- SCRIPT DE SEGURIDAD (RLS) PARA GESTIÓN DINÁMICA DE IMPRESORAS
-- =========================================================================================
-- Descripción:
-- Otorga permisos completos (Ver, Crear, Actualizar y Eliminar) sobre la 
-- tabla "printers" para cualquier usuario del restaurante que haya iniciado sesión (authenticated).
--
-- Ejecuta este script copiándolo y pegándolo en tu "SQL Editor" de Supabase
-- =========================================================================================

-- 1. Eliminar cualquier política restrictiva previa que pueda causar conflictos
DROP POLICY IF EXISTS "Permitir lectura de impresoras" ON public.printers;
DROP POLICY IF EXISTS "Permitir gestion total de impresoras" ON public.printers;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.printers;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.printers;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.printers;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON public.printers;

-- 2. Asegurarse de que el motor de seguridad (Row-Level Security) está activado
ALTER TABLE public.printers ENABLE ROW LEVEL SECURITY;

-- 3. Crear una política universal que le permite a todos los administradores/cajeros autenticados
--    realizar operaciones de CRUD (Select, Insert, Update, Delete) sin bloqueos.
CREATE POLICY "Permitir gestion total de impresoras" 
ON public.printers
FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);

-- Listo! Ya puedes volver a la interfaz gráfica en React y crear cuantas impresoras quieras.
