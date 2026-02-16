import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Order, OrderItem } from "@/types/database";
import { printComanda } from "@/lib/printService";

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
          order_id: newOrder.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          notes: item.notes || null,
          status: "activo",
        }));
        const { error: itemsError } = await supabase
          .from("order_items")
          .insert(orderItems);
        if (itemsError) throw itemsError;

        // Print comandas to assigned printers
        const productIds = [...new Set(items.map((i) => i.product_id))];
        const { data: products } = await supabase
          .from("products")
          .select("id, category_id")
          .in("id", productIds);
        const categoryMap = new Map((products || []).map((p) => [p.id, p.category_id]));

        const typeLabel = order.type === "domicilio" ? "DOMICILIO" : order.type === "recoger" ? "RECOGER" : "MESA";
        const orderLabel = `${typeLabel} #${newOrder.order_number}`;
        const printItems = items.map((item) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          notes: item.notes || null,
          category_id: categoryMap.get(item.product_id) || null,
        }));
        printComanda(printItems, orderLabel, order.client_name || undefined).catch(console.error);
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
