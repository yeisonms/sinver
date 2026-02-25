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

export function useMoveTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      sourceTableId,
      targetTableId,
      orderId,
      waiterId,
      targetAreaId, // To invalidate the target area UI
      sourceAreaId, // To invalidate the source area UI
    }: {
      sourceTableId: string;
      targetTableId: string;
      orderId: string;
      waiterId: string | null;
      targetAreaId: string;
      sourceAreaId: string;
    }) => {
      // 1. Point the order to the new table
      const { error: orderErr } = await supabase
        .from("orders")
        .update({ table_id: targetTableId })
        .eq("id", orderId);
      if (orderErr) throw orderErr;

      // 2. Mark target table as occupied
      const { error: targetErr } = await supabase
        .from("tables")
        .update({
          status: "ocupada",
          current_order_id: orderId,
          current_waiter_id: waiterId,
        })
        .eq("id", targetTableId);
      if (targetErr) throw targetErr;

      // 3. Mark source table as free
      const { error: sourceErr } = await supabase
        .from("tables")
        .update({
          status: "libre",
          current_order_id: null,
          current_waiter_id: null,
        })
        .eq("id", sourceTableId);
      if (sourceErr) throw sourceErr;

      return { sourceAreaId, targetAreaId };
    },
    onSuccess: ({ sourceAreaId, targetAreaId }) => {
      qc.invalidateQueries({ queryKey: ["tables", sourceAreaId] });
      if (sourceAreaId !== targetAreaId) {
        qc.invalidateQueries({ queryKey: ["tables", targetAreaId] });
      }
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}
