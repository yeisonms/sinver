import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  notes: string | null;
  status?: string;
  cancellation_reason?: string | null;
  product_name?: string;
}

export function useOrderItems(orderId: string | null) {
  return useQuery<OrderItemRow[]>({
    queryKey: ["order-items", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("*, products:product_id(name)")
        .eq("order_id", orderId!);
      if (error) throw error;
      return (data ?? []).map((item: any) => ({
        id: item.id,
        order_id: item.order_id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        notes: item.notes,
        status: item.status ?? "activo",
        cancellation_reason: item.cancellation_reason ?? null,
        product_name: item.products?.name ?? "Producto",
      }));
    },
    refetchInterval: 5000,
  });
}

export function useAddOrderItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, productId, quantity, unitPrice }: { orderId: string; productId: string; quantity: number; unitPrice: number }) => {
      const { error } = await supabase.from("order_items").insert({
        order_id: orderId,
        product_id: productId,
        quantity,
        unit_price: unitPrice,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["order-items", vars.orderId] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

export function useCancelOrderItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, reason, orderId }: { itemId: string; reason: string; orderId: string }) => {
      const { data: canceledItem, error } = await supabase
        .from("order_items")
        .update({ status: "cancelado", cancellation_reason: reason })
        .eq("id", itemId)
        .select()
        .single();
      if (error) throw error;

      if (canceledItem) {
        const discount = canceledItem.quantity * canceledItem.unit_price;
        const { data: orderData } = await supabase.from("orders").select("total_amount").eq("id", orderId).single();
        if (orderData) {
          await supabase.from("orders").update({ total_amount: Math.max(0, orderData.total_amount - discount) }).eq("id", orderId);
        }
      }

      return orderId;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["order-items", vars.orderId] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}
