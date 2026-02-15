import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Order, OrderItem } from "@/types/database";

export function useOrders(statuses: string[]) {
  return useQuery<Order[]>({
    queryKey: ["orders", statuses],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .in("status", statuses)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Order[];
    },
    refetchInterval: 10000,
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      order,
      items,
    }: {
      order: Omit<Order, "id" | "order_number" | "created_at">;
      items: Omit<OrderItem, "id" | "order_id">[];
    }) => {
      const { data: newOrder, error: orderError } = await supabase
        .from("orders")
        .insert(order)
        .select()
        .single();
      if (orderError) throw orderError;

      if (items.length > 0) {
        const orderItems = items.map(({ product_name, modifiers, ...item }) => ({
          ...item,
          order_id: newOrder.id,
        }));
        const { error: itemsError } = await supabase
          .from("order_items")
          .insert(orderItems);
        if (itemsError) throw itemsError;
      }

      return newOrder;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

export function useFavoriteProducts() {
  return useQuery({
    queryKey: ["products", "favorites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_favorite", true)
        .eq("is_available", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useSearchProducts(search: string) {
  return useQuery({
    queryKey: ["products", "search", search],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_available", true)
        .ilike("name", `%${search}%`)
        .order("name")
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: search.length >= 2,
  });
}
