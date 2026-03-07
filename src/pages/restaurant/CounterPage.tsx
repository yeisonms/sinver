import { useState } from "react";
import { Search, Plus, Loader2, ShoppingBag, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOrders } from "@/hooks/useOrders";
import { useOrderItems } from "@/hooks/useOrderItems";
import { NewOrderSheet } from "@/components/restaurant/NewOrderSheet";
import { WebOrderInboxCard } from "@/components/restaurant/WebOrderInboxCard";
import { OrderDetailPanel } from "@/components/restaurant/OrderDetailPanel";
import { CheckoutDialog } from "@/components/restaurant/CheckoutDialog";
import { useRestaurantInfo } from "@/hooks/useRestaurantInfo";
import type { Order } from "@/types/database";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";

const statusLabels: Record<string, string> = {
  pendiente: "Pendiente",
  en_preparacion: "En Curso",
  pendiente_online: "Nuevo",
};

const statusFilters = [
  { label: "Todos", value: "all" },
  { label: "En Curso", value: "en_preparacion" },
  { label: "Pagando", value: "pendiente" },
];

export default function CounterPage() {
  const { info: restaurantInfo } = useRestaurantInfo();
  const tipRate = restaurantInfo?.default_tip_percentage ?? 0;

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const [checkoutOrder, setCheckoutOrder] = useState<Order | null>(null);
  const [closing, setClosing] = useState(false);

  const isMobile = useIsMobile();
  const qc = useQueryClient();

  // Inbox: pickup orders from online store
  const { data: inboxOrders = [], isLoading: loadInbox } = useOrders(["pendiente_online"]);
  const pickupInbox = inboxOrders.filter((o) => o.type === "recoger");

  const { data: allActive = [], isLoading: loadActive } = useOrders(["pendiente", "en_preparacion"]);
  const active = allActive.filter((o) => o.type !== "mesa");

  const filtered = active.filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (searchTerm) {
      return (
        o.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(o.order_number).includes(searchTerm)
      );
    }
    return true;
  });

  const selectedOrder = active.find((o) => o.id === selectedOrderId) ?? null;

  const { data: checkoutItems = [] } = useOrderItems(checkoutOrder?.id ?? null);
  const checkoutActiveItems = checkoutItems.filter((i) => i.status !== "cancelado");
  const consumedTotal = checkoutActiveItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);

  const handleCheckout = async (data: { tipAmount: number; paymentMethod: string; grandTotal: number }) => {
    if (!checkoutOrder) return;
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
        order_id: checkoutOrder.id,
        cash_register_id: openRegisterId,
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
        .eq("id", checkoutOrder.id);
      if (orderErr) throw orderErr;

      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["sales-orders"] });
      toast.success("Pedido cerrado y cobro registrado");
      setCheckoutOrder(null);
      setSelectedOrderId(null);
    } catch (err: any) {
      toast.error(err?.message || "Error al cerrar pedido");
    } finally {
      setClosing(false);
    }
  };

  // Mobile: order list view
  if (isMobile) {
    return (
      <div className="flex flex-col h-full">
        {/* Top Header */}
        <div className="px-4 pt-4 pb-3 space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar pedido..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-11 rounded-xl bg-background border-border/50 shadow-sm"
              />
            </div>
            <Button onClick={() => setSheetOpen(true)} className="h-11 rounded-xl shadow-premium gap-1.5 px-4 shrink-0 font-semibold text-sm">
              <Plus className="h-4 w-4" />
              Crear pedido
            </Button>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {statusFilters.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`px-4 py-2.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${statusFilter === f.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                  }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Pickup inbox */}
        {pickupInbox.length > 0 && (
          <div className="px-4 pb-2">
            <div className="bg-orange-50 rounded-lg border border-orange-200 space-y-0 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-orange-100">
                <ShoppingBag className="h-4 w-4 text-orange-600" />
                <span className="text-xs font-bold uppercase text-orange-700">Web - Recoger ({pickupInbox.length})</span>
              </div>
              <div className="divide-y divide-orange-100/50">
                {pickupInbox.map((o) => (
                  <WebOrderInboxCard key={o.id} order={o} restaurantName={restaurantInfo?.restaurant_name ?? undefined} compact />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Order list */}
        <div className="flex-1 overflow-auto">
          {loadActive ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin pedidos en curso.</p>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setSelectedOrderId(o.id)}
                  className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-muted/50 active:bg-muted transition-colors"
                >
                  <div>
                    <p className="font-bold text-sm">Pedido {o.order_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(o.created_at), "M/d HH:mm")} - {o.client_name ?? "—"}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        <NewOrderSheet open={sheetOpen} onOpenChange={setSheetOpen} />

        {selectedOrder && (
          <div className="fixed inset-0 z-50 bg-background flex flex-col">
            <div className="bg-navbar text-navbar-foreground h-14 flex items-center px-4 gap-3 shrink-0">
              <Button variant="ghost" size="icon" className="text-navbar-foreground hover:bg-white/10" onClick={() => setSelectedOrderId(null)}>
                <ChevronRight className="h-5 w-5 rotate-180" />
              </Button>
              <h2 className="font-bold">Pedido {selectedOrder.order_number}</h2>
            </div>
            <div className="flex-1 overflow-auto">
              <OrderDetailPanel
                order={selectedOrder}
                onCheckout={(order) => setCheckoutOrder(order)}
              />
            </div>
          </div>
        )}

        <CheckoutDialog
          open={!!checkoutOrder}
          onOpenChange={(v) => { if (!v) setCheckoutOrder(null); }}
          title="Cerrar Pedido"
          subtitle={`Pedido #${checkoutOrder?.order_number ?? ""}`}
          consumedTotal={consumedTotal}
          closing={closing}
          tipRate={tipRate}
          onConfirm={handleCheckout}
        />
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="flex flex-col h-full bg-background/50">
      {/* Top bar */}
      <div className="mx-6 mt-4 mb-4 flex items-center gap-4 px-6 py-4 bg-card/80 backdrop-blur-xl border border-white/20 shadow-premium-soft rounded-2xl">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Buscar pedido por cliente o ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-11 h-12 rounded-xl bg-background border-border/50 shadow-inner text-base"
          />
        </div>
        <Button onClick={() => setSheetOpen(true)} className="h-12 px-6 rounded-xl shadow-premium hover:shadow-premium-hover transition-all gap-2 text-base font-medium">
          <Plus className="h-5 w-5" />
          Nuevo Pedido
        </Button>
      </div>

      {/* Split view */}
      <div className="flex flex-1 overflow-hidden px-6 pb-6 gap-6">
        {/* Left: Order list (45%) */}
        <div className="w-[45%] bg-card shadow-premium rounded-2xl border border-white/40 flex flex-col overflow-hidden">
          {/* Pickup Inbox */}
          {(pickupInbox.length > 0 || loadInbox) && (
            <div className="border-b border-border/50 bg-orange-50/50">
              <div className="px-5 py-3 border-b border-orange-100 flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-widest text-primary">
                  Pedidos Web - Recoger ({pickupInbox.length})
                </span>
              </div>
              {loadInbox ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-primary/50" />
                </div>
              ) : (
                <div className="divide-y divide-orange-100/50">
                  {pickupInbox.map((o) => (
                    <WebOrderInboxCard key={o.id} order={o} restaurantName={restaurantInfo?.restaurant_name ?? undefined} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Active orders list */}
          <div className="flex-1 overflow-auto bg-card">
            {loadActive ? (
              <div className="flex justify-center items-center h-full">
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
                  <p className="text-sm font-medium">Cargando pedidos...</p>
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-3">
                <ShoppingBag className="h-12 w-12 text-border" />
                <p className="text-sm font-medium">No hay pedidos en curso</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-secondary/30 sticky top-0 backdrop-blur-md z-10">
                  <TableRow className="border-b border-border/50 hover:bg-transparent">
                    <TableHead className="w-16 text-xs font-semibold tracking-wider text-muted-foreground uppercase pl-5">Nº</TableHead>
                    <TableHead className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Hora</TableHead>
                    <TableHead className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Estado</TableHead>
                    <TableHead className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Cliente</TableHead>
                    <TableHead className="text-right text-xs font-semibold tracking-wider text-muted-foreground uppercase pr-5">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((o) => (
                    <TableRow
                      key={o.id}
                      className={`cursor-pointer transition-all border-b border-border/30 last:border-0 ${selectedOrderId === o.id
                        ? "bg-primary/5 hover:bg-primary/10"
                        : "hover:bg-secondary/40"
                        }`}
                      onClick={() => setSelectedOrderId(o.id)}
                    >
                      <TableCell className="pl-5">
                        <div className={`font-mono text-sm font-bold ${selectedOrderId === o.id ? "text-primary" : ""}`}>
                          {o.order_number}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(o.created_at), "HH:mm")}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${o.status === 'en_preparacion' ? 'bg-amber-100 text-amber-700' : 'bg-primary/10 text-primary'
                          }`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${o.status === 'en_preparacion' ? 'bg-amber-500' : 'bg-primary'}`}></span>
                          {statusLabels[o.status] ?? o.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm font-medium text-foreground">{o.client_name ?? "—"}</TableCell>
                      <TableCell className="text-right font-semibold text-sm pr-5">${o.total_amount.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        {/* Right: Detail panel (55%) */}
        <div className="w-[55%] h-full bg-card shadow-premium rounded-2xl border border-white/40 overflow-hidden relative">
          {selectedOrder ? (
            <OrderDetailPanel
              order={selectedOrder}
              onCheckout={(order) => setCheckoutOrder(order)}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-transparent to-secondary/20">
              <div className="w-24 h-24 mb-6 rounded-full bg-secondary flex items-center justify-center shadow-inner">
                <ShoppingBag className="h-10 w-10 text-muted-foreground/40" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">Detalles del Pedido</h3>
              <p className="text-sm text-muted-foreground max-w-sm text-center">
                Selecciona un pedido de la lista a la izquierda para ver los detalles, artículos y proceder al cobro.
              </p>
            </div>
          )}
        </div>
      </div>

      <NewOrderSheet open={sheetOpen} onOpenChange={setSheetOpen} />

      <CheckoutDialog
        open={!!checkoutOrder}
        onOpenChange={(v) => { if (!v) setCheckoutOrder(null); }}
        title="Cerrar Pedido"
        subtitle={`Pedido #${checkoutOrder?.order_number ?? ""}`}
        consumedTotal={consumedTotal}
        closing={closing}
        tipRate={tipRate}
        onConfirm={handleCheckout}
      />
    </div>
  );
}
