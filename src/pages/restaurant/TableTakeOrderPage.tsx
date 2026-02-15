import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { OrderStep2 } from "@/components/restaurant/OrderStep2";
import type { CartItem } from "@/components/restaurant/NewOrderSheet";
import { toast } from "sonner";

export default function TableTakeOrderPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
  });

  const [cart, setCart] = useState<CartItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const total = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

  const handleAddToCart = (item: CartItem) => {
    setCart((prev) => {
      const existing = prev.findIndex((c) => c.product_id === item.product_id && c.notes === item.notes);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], quantity: updated[existing].quantity + item.quantity };
        return updated;
      }
      return [...prev, item];
    });
  };

  const handleRemoveFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateCartItem = (index: number, updated: CartItem) => {
    setCart((prev) => prev.map((item, i) => (i === index ? updated : item)));
  };

  const handleCloseOrder = async () => {
    if (!orderId || cart.length === 0) return;
    setSubmitting(true);
    try {
      // Insert order items
      const items = cart.map(({ product_name, ...item }) => ({
        ...item,
        order_id: orderId,
      }));
      const { error: itemsErr } = await supabase.from("order_items").insert(items);
      if (itemsErr) throw itemsErr;

      // Update order total
      const { error: orderErr } = await supabase
        .from("orders")
        .update({ total_amount: total })
        .eq("id", orderId);
      if (orderErr) throw orderErr;

      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Productos agregados al pedido");
      navigate("/restaurant/tables");
    } catch (err: any) {
      toast.error(err?.message || "Error al guardar");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-card">
        <Button variant="ghost" size="icon" onClick={() => navigate("/restaurant/tables")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-sm font-bold">
          Pedido Mesa — #{order?.order_number ?? "..."}
        </h2>
      </div>
      <div className="flex-1 overflow-hidden">
        <OrderStep2
          cart={cart}
          total={total}
          onAddToCart={handleAddToCart}
          onRemoveFromCart={handleRemoveFromCart}
          onUpdateCartItem={handleUpdateCartItem}
          onCloseOrder={handleCloseOrder}
          isSubmitting={submitting}
          onBack={() => navigate("/restaurant/tables")}
        />
      </div>
    </div>
  );
}
