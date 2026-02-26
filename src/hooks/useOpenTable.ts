import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface OpenTableParams {
  tableId: string;
  areaId: string;
  waiterId: string;
  dinerCount: number;
  comment: string | null;
}

export function useOpenTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tableId, areaId, waiterId, dinerCount, comment }: OpenTableParams) => {
      // 1. Create order
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          table_id: tableId,
          waiter_id: waiterId,
          status: "pendiente",
          type: "mesa",
          total_amount: 0,
          tip_amount: 0,
          diner_count: dinerCount,
          general_notes: comment,
          client_name: null,
          customer_id: null,
        })
        .select()
        .single();
      if (orderErr) throw orderErr;

      // 2. Update table status
      const { error: tableErr } = await supabase
        .from("tables")
        .update({
          status: "ocupada",
          current_order_id: order.id,
          current_waiter_id: waiterId,
          printed_control: false,
        })
        .eq("id", tableId);
      if (tableErr) throw tableErr;

      return order;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["tables", variables.areaId] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}
