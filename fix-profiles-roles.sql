-- =========================================================================================
-- PARCHE DE ROLES (PROFILES) - SOLUCIÓN PARA RESTRICCIÓN CHECK
-- =========================================================================================
-- Descripción:
-- Reconstruye la regla de seguridad interna de la tabla "profiles" para que 
-- la base de datos PostgreSQL acepte todos los roles que existen en la 
-- interfaz del Restaurante ("subadmin", "domiciliario", "mesero", etc.)
--
-- Ejecuta este script copiándolo y pegándolo en tu "SQL Editor" de Supabase
-- =========================================================================================

-- 1. Eliminar la regla de validación antigua (que probablemente no tiene 'subadmin' o 'domiciliario')
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2. Crear la nueva regla de validación expandida incluyendo TODOS los roles del formulario de React
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('admin', 'subadmin', 'mesero', 'domiciliario', 'cajero', 'cocina'));

-- ¡Listo! Ya puedes volver a la vista del sistema y cambiarle el rol a los usuarios de tu equipo sin errores.
