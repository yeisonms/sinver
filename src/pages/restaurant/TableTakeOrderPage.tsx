import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Receipt, Printer, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CheckoutDialog } from "@/components/restaurant/CheckoutDialog";
import { MoveTableDialog } from "@/components/restaurant/MoveTableDialog";
import TableControlReceipt from "@/components/restaurant/TableControlReceipt";
import { useRestaurantInfo } from "@/hooks/useRestaurantInfo";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { OrderStep2 } from "@/components/restaurant/OrderStep2";
import type { CartItem } from "@/components/restaurant/NewOrderSheet";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { printComanda, printControlReceipt } from "@/lib/printService";
import { createRoot } from "react-dom/client";

export default function TableTakeOrderPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { info: restaurantInfo } = useRestaurantInfo();
  const tipRate = restaurantInfo?.default_tip_percentage ?? 0;
  const isMobile = useIsMobile();
  const { role, user } = useAuth();
  const canCheckout = role === "admin" || role === "cajero";

  const { data: order, isLoading: loadingOrder } = useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, tables:table_id(*)")
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  const [moveTableOpen, setMoveTableOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [checkoutOrderOverride, setCheckoutOrderOverride] = useState<any>(null);

  // Fetch current user's profile name for the receipt
  const { data: currentProfile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const handlePrintControl = async () => {
    const allItems = [
      ...existingItems.map((i) => ({ name: i.product_name, quantity: i.quantity, unit_price: i.unit_price })),
      ...cart.map((i) => ({ name: i.product_name, quantity: i.quantity, unit_price: i.unit_price })),
    ];
    if (allItems.length === 0) {
      toast.warning("No hay productos para imprimir");
      return;
    }

    try {
      await printControlReceipt({
        restaurantName: (restaurantInfo as any)?.restaurant_name ?? "MI RESTAURANTE",
        nit: (restaurantInfo as any)?.nit ?? "",
        address: (restaurantInfo as any)?.address ?? "",
        phone: (restaurantInfo as any)?.phone ?? "",
        taxRegime: (restaurantInfo as any)?.tax_regime ?? "",
        posResolution: (restaurantInfo as any)?.pos_resolution ?? "",
        slogan: (restaurantInfo as any)?.slogan ?? "",
        footerMessage: (restaurantInfo as any)?.footer_message ?? "",
        tableName: order?.tables?.name ?? "?",
        orderNumber: order?.order_number ?? 0,
        waiterName: currentProfile?.full_name ?? user?.email ?? "—",
        items: allItems,
        tipPercentage: tipRate,
      });

      if (order?.table_id) {
        await supabase.from("tables").update({ printed_control: true }).eq("id", order.table_id);
      }
      toast.success("Control impreso correctamente");
    } catch (error) {
      console.error("Error printing control ticket:", error);
      toast.error("Hubo un error al imprimir el control");
    }
  };

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

  const getReturnUrl = () => {
    if (order?.type === "recoger") return "/restaurant/counter";
    if (order?.type === "domicilio") return "/restaurant/delivery";
    return "/restaurant/tables";
  };

  const handleSendToKitchen = async () => {
    if (!orderId || cart.length === 0) return;
    setSubmitting(true);
    try {
      // Fetch category_id for each product in cart
      const productIds = [...new Set(cart.map((c) => c.product_id))];
      const { data: products } = await supabase
        .from("products")
        .select("id, category_id")
        .in("id", productIds);
      const categoryMap = new Map((products || []).map((p) => [p.id, p.category_id]));

      const items = cart.map((item) => {
        const modText = item.modifiers?.map((m) => m.option_name).join(", ") || "";
        const finalNotes = [modText, item.notes].filter(Boolean).join(" - ");
        return {
          order_id: orderId,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          notes: finalNotes || null,
          status: "activo",
        };
      });
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

      // Print comandas to assigned printers
      const tableName = (order?.tables as any)?.name;
      let orderLabel = tableName ? `MESA ${tableName} - Pedido #${order?.order_number ?? "?"}` : `MESA #${order?.order_number ?? "?"}`;
      if (order?.type === "recoger") orderLabel = `MOSTRADOR #${order?.order_number ?? "?"}`;
      if (order?.type === "domicilio") orderLabel = `DOMICILIO #${order?.order_number ?? "?"}`;

      const printItems = cart.map((item) => {
        const modText = item.modifiers?.map((m) => m.option_name).join(", ") || "";
        const finalNotes = [modText, item.notes].filter(Boolean).join(" - ");
        return {
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          notes: finalNotes || null,
          category_id: categoryMap.get(item.product_id) || null,
        };
      });
      // Fetch waiter name for ticket
      let waiterName: string | undefined;
      if (order?.waiter_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", order.waiter_id)
          .maybeSingle();
        waiterName = profile?.full_name || undefined;
      }

      printComanda({
        items: printItems,
        orderLabel,
        clientName: order?.client_name || undefined,
        waiterName,
        orderType: order?.type || "mesa",
        generalNotes: order?.general_notes,
      }).catch(console.error);

      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order-items", orderId] });
      qc.invalidateQueries({ queryKey: ["tables"] });
      toast.success("Comanda enviada a cocina");
      navigate(getReturnUrl());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      toast.error(e.message || "Error al enviar a cocina");
      qc.invalidateQueries({ queryKey: ["orders"] });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSplitSuccess = async (newOrderId: string) => {
    // 1. Fetch the new branched order details so we can checkout immediately
    try {
      const { data: newOrderData, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", newOrderId)
        .single();

      if (error) throw error;

      if (newOrderData) {
        setCheckoutOpen(true);
        // We override the default checkoutOrder behavior dynamically here
        // Set this temporary state to tell the checkout modal which ID to process.
        // To be safe, we temporarily override `order` inside `checkoutOpen`.

        // Let's pass it to a new state called `checkoutOrderOverride`
        setCheckoutOrderOverride(newOrderData as any);
      }
    } catch (err) {
      console.error("Error fetching split order for checkout:", err);
      toast.error("Cuenta dividida, pero no se pudo abrir el cobro automáticamente.");
    }
  };

  const handleCheckout = async (data: { tipAmount: number; paymentMethod: string; grandTotal: number }) => {
    // Determine which order we're checking out
    const targetOrder = checkoutOrderOverride || order;
    if (!targetOrder) return;

    setClosing(true);
    try {
      const { data: openRegisters } = await supabase
        .from("cash_registers")
        .select("id")
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(1);

      const openRegisterId = openRegisters?.[0]?.id ?? null;

      const { error: payErr } = await supabase.from("payments").insert({
        order_id: targetOrder.id,
        cash_register_id: openRegisterId,
        amount: data.grandTotal,
        method: data.paymentMethod,
      });
      if (payErr) throw payErr;

      // Ensure we hit the database to calculate total_amount directly for the specific order.
      // `consumedTotal` at the file scope maps to the *active* page order, not the override one.
      const { data: splitItems } = await supabase
        .from("order_items")
        .select("quantity, unit_price")
        .eq("order_id", targetOrder.id)
        .neq("status", "cancelado");

      const overrideConsumedTotal = (splitItems || []).reduce((s, i) => s + i.quantity * i.unit_price, 0);

      const { error: orderErr } = await supabase
        .from("orders")
        .update({
          status: "cerrado",
          total_amount: overrideConsumedTotal,
          tip_amount: data.tipAmount,
          closed_at: new Date().toISOString(),
          payment_method: data.paymentMethod,
        })
        .eq("id", targetOrder.id);
      if (orderErr) throw orderErr;

      if (targetOrder.table_id) {
        const { count: remainingCount } = await supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("table_id", targetOrder.table_id)
          .neq("status", "cerrado")
          .neq("status", "cancelado");

        if (remainingCount === 0) {
          await supabase.from("tables").update({ status: "libre", current_order_id: null, printed_control: false }).eq("id", targetOrder.table_id);
        }
      }

      toast.success("Pago registrado exitosamente");
      qc.invalidateQueries({ queryKey: ["temp_orders"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["sales-orders"] });
      qc.invalidateQueries({ queryKey: ["tables"] });

      setCheckoutOpen(false);

      // If we just settled the main order of the page, bounce out.
      if (targetOrder.id === order?.id) {
        navigate(getReturnUrl());
      } else {
        // We settled a child-split, so reload the same page data
        setCheckoutOrderOverride(null);
        qc.invalidateQueries({ queryKey: ["order-items", orderId] });
      }
    } catch (e: any) {
      toast.error(e.message || "Error al procesar el pago");
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
          <Button variant="ghost" size="icon" onClick={() => navigate(getReturnUrl())}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-sm font-bold flex-1 uppercase">
            Pedido {order?.type === "mesa" ? "Mesa" : order?.type === "recoger" ? "Mostrador" : "Domicilio"} — #{order?.order_number ?? "..."}
          </h2>
          {order?.type === "mesa" && order?.tables && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-blue-600 bg-blue-500/10 hover:bg-blue-600 hover:text-white border-blue-500/20"
              onClick={() => setMoveTableOpen(true)}
            >
              <ArrowRightLeft className="h-4 w-4" />
              Trasladar
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={!hasExistingItems && cart.length === 0}
            onClick={handlePrintControl}
          >
            <Printer className="h-4 w-4" />
            Imprimir Control
          </Button>
          {canCheckout && (
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
          )}
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
          onBack={() => navigate(getReturnUrl())}
          mode={order?.type || "mesa"}
        />
      </div>

      {canCheckout && (
        <>
          {checkoutOrderOverride ? (
            <CheckoutDialog
              open={checkoutOpen}
              onOpenChange={(v) => {
                if (!v) {
                  setCheckoutOpen(false);
                  setCheckoutOrderOverride(null);
                }
              }}
              title="Cobrar Cuenta Dividida"
              subtitle={`Pedido Alterno (Mesa ${order?.tables?.name})`}
              consumedTotal={checkoutOrderOverride.total_amount || 0}
              closing={closing}
              tipRate={tipRate}
              onConfirm={handleCheckout}
            />
          ) : (
            <CheckoutDialog
              open={checkoutOpen}
              onOpenChange={(v) => { if (!v) setCheckoutOpen(false); }}
              title="Cobrar Orden Activa"
              subtitle={`Mesa ${order?.tables?.name}`}
              consumedTotal={consumedTotal}
              closing={closing}
              tipRate={tipRate}
              onConfirm={handleCheckout}
            />
          )}
        </>
      )}

      {order?.tables && (
        <MoveTableDialog
          open={moveTableOpen}
          onOpenChange={setMoveTableOpen}
          sourceTable={order.tables}
        />
      )}
    </div>
  );
}
