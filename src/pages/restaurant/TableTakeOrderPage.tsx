import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { OrderStep2 } from "@/components/restaurant/OrderStep2";
import type { CartItem } from "@/components/restaurant/NewOrderSheet";
import { toast } from "sonner";

export default function TableTakeOrderPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

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

  // Checkout dialog state
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [tip, setTip] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("efectivo");
  const [closing, setClosing] = useState(false);

  const total = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const existingTotal = existingItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const consumedTotal = existingTotal + total;
  const tipAmount = parseFloat(tip) || 0;
  const grandTotal = consumedTotal + tipAmount;

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
      const items = cart.map(({ product_name, modifiers, ...item }) => ({
        ...item,
        order_id: orderId,
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

  const handleCheckout = async () => {
    if (!orderId || !order) return;
    setClosing(true);
    try {
      // If there are unsaved cart items, save them first
      if (cart.length > 0) {
        const items = cart.map(({ product_name, modifiers, ...item }) => ({
          ...item,
          order_id: orderId,
        }));
        const { error: itemsErr } = await supabase.from("order_items").insert(items);
        if (itemsErr) throw itemsErr;
      }

      // Find open cash register (optional)
      const { data: openRegister } = await supabase
        .from("cash_registers")
        .select("id")
        .eq("status", "open")
        .maybeSingle();

      // Create payment record
      const { error: payErr } = await supabase.from("payments").insert({
        order_id: orderId,
        cash_register_id: openRegister?.id ?? null,
        amount: grandTotal,
        method: paymentMethod,
      });
      if (payErr) throw payErr;

      // Update order: close it
      const { error: orderErr, count: updatedCount } = await supabase
        .from("orders")
        .update({
          status: "cerrado",
          total_amount: consumedTotal,
          tip_amount: tipAmount,
          closed_at: new Date().toISOString(),
          payment_method: paymentMethod,
        })
        .eq("id", orderId);
      if (orderErr) throw orderErr;

      // Verify the update actually happened (RLS can silently block updates)
      const { data: verifyOrder } = await supabase
        .from("orders")
        .select("status")
        .eq("id", orderId)
        .maybeSingle();
      if (verifyOrder && verifyOrder.status !== "cerrado") {
        throw new Error("La orden no se pudo actualizar. Verifica las políticas de seguridad (RLS) en la tabla 'orders' para permitir UPDATE a usuarios autenticados.");
      }

      // Free the table
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
          onClick={() => {
            setTip("0");
            setPaymentMethod("efectivo");
            setCheckoutOpen(true);
          }}
        >
          <Receipt className="h-4 w-4" />
          Cobrar
        </Button>
      </div>
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

      {/* Checkout Dialog */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cerrar Cuenta</DialogTitle>
            <DialogDescription>Mesa {order?.order_number ? `#${order.order_number}` : ""}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Consumed total */}
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">Total Consumido</span>
              <span className="text-lg font-bold">${consumedTotal.toLocaleString()}</span>
            </div>

            {/* Tip */}
            <div>
              <Label className="text-xs">Propina (opcional)</Label>
              <Input
                type="number"
                min={0}
                value={tip}
                onChange={(e) => setTip(e.target.value)}
                placeholder="0"
              />
            </div>

            {/* Payment method */}
            <div>
              <Label className="text-xs">Método de Pago</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">💵 Efectivo</SelectItem>
                  <SelectItem value="tarjeta">💳 Tarjeta</SelectItem>
                  <SelectItem value="transferencia">🏦 Transferencia</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Grand total */}
            <div className="flex items-center justify-between py-3 border-t border-border bg-muted/50 -mx-6 px-6 rounded-b-lg">
              <span className="font-semibold">Total a Pagar</span>
              <span className="text-xl font-bold text-primary">${grandTotal.toLocaleString()}</span>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleCheckout}
              disabled={closing}
              className="w-full"
            >
              {closing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Cobrar y Cerrar Mesa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
