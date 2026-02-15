import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CheckoutDialog } from "@/components/restaurant/CheckoutDialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { OrderStep2 } from "@/components/restaurant/OrderStep2";
import type { CartItem } from "@/components/restaurant/NewOrderSheet";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

export default function TableTakeOrderPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isMobile = useIsMobile();

  const { data: order, isLoading: loadingOrder } = useQuery({
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

  const { data: existingItems = [], isLoading: loadingItems } = useQuery<CartItem[]>({
    queryKey: ["order-items", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("*, products:product_id(name)")
        .eq("order_id", orderId!);
      if (error) throw error;
      return (data ?? []).map((item: any) => ({
        product_id: item.product_id,
        product_name: item.products?.name ?? "Producto",
        quantity: item.quantity,
        unit_price: item.unit_price,
        notes: item.notes,
      }));
    },
    enabled: !!orderId,
  });

  const [cart, setCart] = useState<CartItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  const total = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const existingTotal = existingItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const consumedTotal = existingTotal + total;

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

  const handleSendToKitchen = async () => {
    if (!orderId || cart.length === 0) return;
    setSubmitting(true);
    try {
      const items = cart.map((item) => ({
        order_id: orderId,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        notes: item.notes || null,
        status: "activo",
      }));
      const { error: itemsErr } = await supabase.from("order_items").insert(items);
      if (itemsErr) throw itemsErr;

      const { error: orderErr } = await supabase
        .from("orders")
        .update({
          total_amount: existingTotal + total,
          status: "en_preparacion",
        })
        .eq("id", orderId);
      if (orderErr) throw orderErr;

      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order-items", orderId] });
      qc.invalidateQueries({ queryKey: ["tables"] });
      toast.success("Comanda enviada a cocina");
      navigate("/restaurant/tables");
    } catch (err: any) {
      toast.error(err?.message || "Error al enviar comanda");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckout = async (data: { tipAmount: number; paymentMethod: string; grandTotal: number }) => {
    if (!orderId || !order) return;
    setClosing(true);
    try {
      if (cart.length > 0) {
        const items = cart.map((item) => ({
          order_id: orderId,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          notes: item.notes || null,
          status: "activo",
        }));
        const { error: itemsErr } = await supabase.from("order_items").insert(items);
        if (itemsErr) throw itemsErr;
      }

      const { data: openRegister } = await supabase
        .from("cash_registers")
        .select("id")
        .eq("status", "open")
        .maybeSingle();

      const { error: payErr } = await supabase.from("payments").insert({
        order_id: orderId,
        cash_register_id: openRegister?.id ?? null,
        amount: data.grandTotal,
        method: data.paymentMethod,
      });
      if (payErr) throw payErr;

      const { error: orderErr } = await supabase
        .from("orders")
        .update({
          status: "cerrado",
          total_amount: consumedTotal,
          tip_amount: data.tipAmount,
          closed_at: new Date().toISOString(),
          payment_method: data.paymentMethod,
        })
        .eq("id", orderId);
      if (orderErr) throw orderErr;

      const { data: verifyOrder } = await supabase
        .from("orders")
        .select("status")
        .eq("id", orderId)
        .maybeSingle();
      if (verifyOrder && verifyOrder.status !== "cerrado") {
        throw new Error("La orden no se pudo actualizar. Verifica las políticas de seguridad (RLS).");
      }

      if (order.table_id) {
        const { error: tableErr } = await supabase
          .from("tables")
          .update({
            status: "libre",
            current_order_id: null,
            current_waiter_id: null,
          })
          .eq("id", order.table_id);
        if (tableErr) throw tableErr;
      }

      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["sales-orders"] });
      qc.invalidateQueries({ queryKey: ["tables"] });
      toast.success("Mesa cerrada y cobro registrado");
      navigate("/restaurant/tables");
    } catch (err: any) {
      toast.error(err?.message || "Error al cerrar mesa");
    } finally {
      setClosing(false);
    }
  };

  if (loadingOrder || loadingItems) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasExistingItems = existingItems.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header - only on desktop; mobile uses OrderStep2's built-in header */}
      {!isMobile && (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-card">
          <Button variant="ghost" size="icon" onClick={() => navigate("/restaurant/tables")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-sm font-bold flex-1">
            Pedido Mesa — #{order?.order_number ?? "..."}
          </h2>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={!hasExistingItems}
            onClick={() => setCheckoutOpen(true)}
          >
            <Receipt className="h-4 w-4" />
            Cobrar
          </Button>
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        <OrderStep2
          cart={cart}
          existingItems={existingItems}
          total={total}
          onAddToCart={handleAddToCart}
          onRemoveFromCart={handleRemoveFromCart}
          onUpdateCartItem={handleUpdateCartItem}
          onCloseOrder={handleSendToKitchen}
          isSubmitting={submitting}
          onBack={() => navigate("/restaurant/tables")}
          mode="mesa"
        />
      </div>

      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        title="Cerrar Cuenta"
        subtitle={`Mesa #${order?.order_number ?? ""}`}
        consumedTotal={consumedTotal}
        closing={closing}
        onConfirm={handleCheckout}
      />
    </div>
  );
}
