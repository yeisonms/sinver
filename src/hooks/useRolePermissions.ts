import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RolePermission {
  id: string;
  role: string;
  permission: string;
  enabled: boolean;
}

export const PERMISSION_CATEGORIES = {
  RESTAURANTE: [
    { key: "close_sales", label: "Cerrar ventas" },
    { key: "charge_table", label: "Cobrar mesa" },
    { key: "print_control", label: "Imprimir control de Mesa" },
    { key: "assign_waiter", label: "Asignar mesero" },
    { key: "create_additions", label: "Crear adiciones" },
    { key: "cancel_additions", label: "Cancelar adiciones" },
    { key: "list_discounts", label: "Listar descuentos" },
    { key: "create_discounts", label: "Crear descuentos" },
    { key: "cancel_discounts", label: "Cancelar descuentos" },
    { key: "modify_price", label: "Modificar precio al adicionar" },
  ],
  VENTAS: [
    { key: "list_sales", label: "Listar" },
    { key: "update_sales", label: "Actualizar" },
    { key: "delete_sales", label: "Eliminar" },
    { key: "export_sales", label: "Exportar" },
    { key: "view_summary", label: "Ver resumen" },
  ],
};

export const ALL_ROLES = ["admin", "subadmin", "mesero", "domiciliario", "cajero", "cocina"] as const;

// Default permissions per role
const DEFAULT_PERMISSIONS: Record<string, Record<string, boolean>> = {
  admin: {
    close_sales: true, charge_table: true, print_control: true, assign_waiter: true,
    create_additions: true, cancel_additions: true, list_discounts: true, create_discounts: true,
    cancel_discounts: true, modify_price: true, list_sales: true, update_sales: true,
    delete_sales: false, export_sales: true, view_summary: true,
  },
  subadmin: {
    close_sales: true, charge_table: true, print_control: true, assign_waiter: true,
    create_additions: true, cancel_additions: true, list_discounts: true, create_discounts: true,
    cancel_discounts: true, modify_price: true, list_sales: true, update_sales: true,
    delete_sales: false, export_sales: true, view_summary: true,
  },
  mesero: {
    close_sales: false, charge_table: false, print_control: true, assign_waiter: false,
    create_additions: true, cancel_additions: true, list_discounts: false, create_discounts: false,
    cancel_discounts: false, modify_price: true, list_sales: false, update_sales: false,
    delete_sales: false, export_sales: false, view_summary: false,
  },
  domiciliario: {
    close_sales: false, charge_table: true, print_control: true, assign_waiter: false,
    create_additions: true, cancel_additions: true, list_discounts: false, create_discounts: false,
    cancel_discounts: false, modify_price: true, list_sales: false, update_sales: false,
    delete_sales: false, export_sales: false, view_summary: false,
  },
  cajero: {
    close_sales: true, charge_table: true, print_control: true, assign_waiter: false,
    create_additions: true, cancel_additions: true, list_discounts: true, create_discounts: true,
    cancel_discounts: true, modify_price: false, list_sales: true, update_sales: false,
    delete_sales: false, export_sales: false, view_summary: true,
  },
  cocina: {
    close_sales: false, charge_table: false, print_control: false, assign_waiter: false,
    create_additions: false, cancel_additions: false, list_discounts: false, create_discounts: false,
    cancel_discounts: false, modify_price: false, list_sales: false, update_sales: false,
    delete_sales: false, export_sales: false, view_summary: false,
  },
};

export function useRolePermissions(role: string | null) {
  return useQuery<Record<string, boolean>>({
    queryKey: ["role-permissions", role],
    enabled: !!role,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_permissions")
        .select("*")
        .eq("role", role!);

      if (error) throw error;

      // Merge defaults with DB values
      const defaults = DEFAULT_PERMISSIONS[role!] || {};
      const result = { ...defaults };
      
      if (data && data.length > 0) {
        for (const row of data) {
          result[row.permission] = row.enabled;
        }
      }

      return result;
    },
  });
}

export function useTogglePermission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ role, permission, enabled }: { role: string; permission: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("role_permissions")
        .upsert(
          { role, permission, enabled },
          { onConflict: "role,permission" }
        );
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["role-permissions", variables.role] });
    },
  });
}

/** Check if the current user has a specific permission */
export function useHasPermission(permission: string) {
  return useQuery<boolean>({
    queryKey: ["my-permission", permission],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!profile?.role) return false;

      const { data } = await supabase
        .from("role_permissions")
        .select("enabled")
        .eq("role", profile.role)
        .eq("permission", permission)
        .maybeSingle();

      if (data) return data.enabled;
      
      // Fallback to defaults
      return DEFAULT_PERMISSIONS[profile.role]?.[permission] ?? false;
    },
  });
}
