import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Table, Area } from "@/types/database";

export function useAreas() {
  return useQuery<Area[]>({
    queryKey: ["areas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("areas")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Area[];
    },
  });
}

export function useCreateArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from("areas")
        .insert({ name })
        .select()
        .single();
      if (error) throw error;
      return data as Area;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["areas"] }),
  });
}

export function useTablesByArea(areaId: string | null) {
  return useQuery<Table[]>({
    queryKey: ["tables", areaId],
    queryFn: async () => {
      if (!areaId) return [];
      const { data, error } = await supabase
        .from("tables")
        .select("*")
        .eq("area_id", areaId);
      if (error) throw error;
      return data as Table[];
    },
    enabled: !!areaId,
  });
}

export function useUpsertTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (table: Omit<Table, "status" | "current_order_id" | "current_waiter_id">) => {
      const { data, error } = await supabase
        .from("tables")
        .upsert(table)
        .select()
        .single();
      if (error) throw error;
      return data as Table;
    },
    onSuccess: (data) => qc.invalidateQueries({ queryKey: ["tables", data.area_id] }),
  });
}

export function useDeleteTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, areaId }: { id: string; areaId: string }) => {
      const { error } = await supabase.from("tables").delete().eq("id", id);
      if (error) throw error;
      return areaId;
    },
    onSuccess: (areaId) => qc.invalidateQueries({ queryKey: ["tables", areaId] }),
  });
}
