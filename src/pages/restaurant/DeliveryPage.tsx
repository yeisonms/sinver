import { useState } from "react";
import { Search, Plus, Loader2, Truck, CheckCircle, XCircle, MapPin, Phone, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useOrders } from "@/hooks/useOrders";
import { useOrderItems } from "@/hooks/useOrderItems";
import { NewDeliverySheet } from "@/components/restaurant/NewDeliverySheet";
import { OrderDetailPanel } from "@/components/restaurant/OrderDetailPanel";
import { CheckoutDialog } from "@/components/restaurant/CheckoutDialog";
import { useRestaurantInfo } from "@/hooks/useRestaurantInfo";
import type { Order } from "@/types/database";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
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
  { label: "Pendiente", value: "pendiente" },
];

export default function DeliveryPage() {
  const { info: restaurantInfo } = useRestaurantInfo();
  const tipRate = restaurantInfo?.default_tip_percentage ?? 0;

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [rejectOrderId, setRejectOrderId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [checkoutOrder, setCheckoutOrder] = useState<Order | null>(null);
  const [closing, setClosing] = useState(false);

  const isMobile = useIsMobile();
  const qc = useQueryClient();

  // Inbox: pedidos web entrantes
  const { data: inboxOrders = [], isLoading: loadInbox } = useOrders(["pendiente_online"]);
  const webInbox = inboxOrders.filter((o) => o.type === "domicilio");

  // Active delivery orders
  const { data: allActive = [], isLoading: loadActive } = useOrders(["pendiente", "en_preparacion"]);
  const activeDeliveries = allActive.filter((o) => o.type === "domicilio");

  const filtered = activeDeliveries.filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (searchTerm) {
      return (
        o.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(o.order_number).includes(searchTerm)
      );
    }
    return true;
  });

  const selectedOrder = activeDeliveries.find((o) => o.id === selectedOrderId) ?? null;

  const { data: checkoutItems = [] } = useOrderItems(checkoutOrder?.id ?? null);
  const checkoutActiveItems = checkoutItems.filter((i) => i.status !== "cancelado");
  const consumedTotal = checkoutActiveItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);

  const handleAcceptOrder = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: "en_preparacion" })
        .eq("id", orderId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Pedido aceptado");
    } catch (err: any) {
      toast.error(err?.message || "Error al aceptar");
    }
  };

  const handleRejectOrder = async () => {
    if (!rejectOrderId) return;
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: "cancelado", rejection_reason: rejectReason || null })
        .eq("id", rejectOrderId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Pedido rechazado");
      setRejectOrderId(null);
      setRejectReason("");
    } catch (err: any) {
      toast.error(err?.message || "Error al rechazar");
    }
  };

  const handleCheckout = async (data: { tipAmount: number; paymentMethod: string; grandTotal: number }) => {
    if (!checkoutOrder) return;
    setClosing(true);
    try {
      const { data: openRegister } = await supabase
        .from("cash_registers")
        .select("id")
        .eq("status", "open")
        .maybeSingle();

      const { error: payErr } = await supabase.from("payments").insert({
        order_id: checkoutOrder.id,
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
        .eq("id", checkoutOrder.id);
      if (orderErr) throw orderErr;

      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["sales-orders"] });
      toast.success("Domicilio cerrado y cobro registrado");
      setCheckoutOrder(null);
      setSelectedOrderId(null);
    } catch (err: any) {
      toast.error(err?.message || "Error al cerrar pedido");
    } finally {
      setClosing(false);
    }
  };

  // ─── Shared dialogs ───
  const rejectDialog = (
    <Dialog open={!!rejectOrderId} onOpenChange={(v) => { if (!v) setRejectOrderId(null); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Rechazar Pedido</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label className="text-xs">Motivo (opcional)</Label>
          <Textarea placeholder="Razón del rechazo..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setRejectOrderId(null)}>Cancelar</Button>
          <Button variant="destructive" onClick={handleRejectOrder}>Confirmar Rechazo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const checkoutDialog = (
    <CheckoutDialog
      open={!!checkoutOrder}
      onOpenChange={(v) => { if (!v) setCheckoutOrder(null); }}
      title="Cerrar Domicilio"
      subtitle={`Pedido #${checkoutOrder?.order_number ?? ""}`}
      consumedTotal={consumedTotal + (checkoutOrder?.delivery_fee ?? 0)}
      closing={closing}
      tipRate={tipRate}
      onConfirm={handleCheckout}
    />
  );

  // ─── MOBILE LAYOUT ───
  if (isMobile) {
    return (
      <div className="flex flex-col h-full">
        {/* Search */}
        <div className="px-4 pt-3 pb-2">
          <Label className="text-xs text-muted-foreground">Buscar domicilio</Label>
          <Input
            placeholder=""
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mt-1"
          />
        </div>

        {/* Status filter tabs */}
        <div className="flex items-center gap-2 px-4 pb-3">
          {statusFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                statusFilter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Delivery inbox */}
        {webInbox.length > 0 && (
          <div className="px-4 pb-2">
            <div className="bg-orange-50 rounded-lg border border-orange-200 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-orange-600" />
                <span className="text-xs font-bold uppercase text-orange-700">Web - Domicilio ({webInbox.length})</span>
              </div>
              {webInbox.map((o) => (
                <div key={o.id} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-sm">#{o.order_number}</span>
                      <span className="text-sm ml-2">{o.client_name ?? "Cliente"}</span>
                    </div>
                    <span className="font-bold text-sm">${o.total_amount.toLocaleString()}</span>
                  </div>
                  {o.delivery_address && (
                    <div className="flex items-start gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                      <span className="truncate">{o.delivery_address}</span>
                    </div>
                  )}
                  <div className="flex gap-1.5 justify-end">
                    <Button size="sm" variant="destructive" className="h-9 text-xs" onClick={() => { setRejectOrderId(o.id); setRejectReason(""); }}>
                      <XCircle className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" className="h-9 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => handleAcceptOrder(o.id)}>
                      <CheckCircle className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Delivery list */}
        <div className="flex-1 overflow-auto">
          {loadActive ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin domicilios en curso.</p>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setSelectedOrderId(o.id)}
                  className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-muted/50 active:bg-muted transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-sm">Pedido {o.order_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(o.created_at), "M/d HH:mm")} - {o.client_name ?? "—"}
                    </p>
                    {o.delivery_address && (
                      <p className="text-[11px] text-muted-foreground truncate">📍 {o.delivery_address}</p>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Fixed bottom button */}
        <div className="border-t border-border p-4 bg-card">
          <Button onClick={() => setSheetOpen(true)} className="w-full h-12 text-base font-semibold gap-2">
            <Plus className="h-5 w-5" />
            Nuevo Domicilio
          </Button>
        </div>

        <NewDeliverySheet open={sheetOpen} onOpenChange={setSheetOpen} />

        {/* Mobile: order detail as full-screen overlay */}
        {selectedOrder && (
          <div className="fixed inset-0 z-50 bg-background flex flex-col">
            <div className="bg-navbar text-navbar-foreground h-14 flex items-center px-4 gap-3 shrink-0">
              <Button variant="ghost" size="icon" className="text-navbar-foreground hover:bg-white/10" onClick={() => setSelectedOrderId(null)}>
                <ChevronRight className="h-5 w-5 rotate-180" />
              </Button>
              <h2 className="font-bold">Pedido {selectedOrder.order_number}</h2>
            </div>
            {/* Delivery info banner */}
            {(selectedOrder.delivery_address || selectedOrder.delivery_phone) && (
              <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 space-y-1">
                {selectedOrder.delivery_address && (
                  <div className="flex items-start gap-1.5 text-sm">
                    <MapPin className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                    <span className="font-medium text-blue-900">{selectedOrder.delivery_address}</span>
                  </div>
                )}
                <div className="flex items-center gap-4">
                  {selectedOrder.delivery_phone && (
                    <div className="flex items-center gap-1 text-sm text-blue-700">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{selectedOrder.delivery_phone}</span>
                    </div>
                  )}
                  {(selectedOrder.delivery_fee ?? 0) > 0 && (
                    <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                      Envío: ${(selectedOrder.delivery_fee ?? 0).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            )}
            <div className="flex-1 overflow-auto">
              <OrderDetailPanel
                order={selectedOrder}
                onCheckout={(order) => setCheckoutOrder(order)}
              />
            </div>
          </div>
        )}

        {checkoutDialog}
        {rejectDialog}
      </div>
    );
  }

  // ─── DESKTOP LAYOUT (unchanged) ───
  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar domicilio por cliente/ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setSheetOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Nuevo Domicilio
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Section A: Inbox + Active List */}
        <div className="w-2/5 overflow-auto border-r border-border flex flex-col">
          {/* Web Inbox */}
          {(webInbox.length > 0 || loadInbox) && (
            <div className="border-b border-border">
              <div className="px-4 py-2 bg-destructive/10 flex items-center gap-2">
                <Truck className="h-4 w-4 text-destructive" />
                <span className="text-xs font-bold uppercase tracking-wide text-destructive">
                  Pedidos Web Entrantes ({webInbox.length})
                </span>
              </div>
              {loadInbox ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {webInbox.map((o) => (
                    <div
                      key={o.id}
                      className="px-4 py-3 bg-destructive/5 animate-pulse-subtle space-y-2 border-l-4 border-destructive"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm">#{o.order_number}</span>
                        <span className="text-xs text-muted-foreground">
                          hace {formatDistanceToNow(new Date(o.created_at), { locale: es })}
                        </span>
                      </div>
                      <div className="text-sm font-medium">{o.client_name ?? "Cliente Web"}</div>
                      {o.delivery_address && (
                        <div className="flex items-start gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                          <span>{o.delivery_address}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm">${o.total_amount.toLocaleString()}</span>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-8 text-xs gap-1"
                            onClick={() => { setRejectOrderId(o.id); setRejectReason(""); }}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Rechazar
                          </Button>
                          <Button
                            size="sm"
                            className="h-8 text-xs gap-1 bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => handleAcceptOrder(o.id)}
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            Aceptar
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Active deliveries list */}
          <div className="flex-1 overflow-auto">
            <div className="px-4 py-2 bg-muted/50 flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-wide">Domicilios Activos ({filtered.length})</span>
            </div>
            {loadActive ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin domicilios en curso.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 text-xs">ID</TableHead>
                    <TableHead className="text-xs">Hora</TableHead>
                    <TableHead className="text-xs">Estado</TableHead>
                    <TableHead className="text-xs">Cliente</TableHead>
                    <TableHead className="text-right text-xs">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((o) => (
                    <TableRow
                      key={o.id}
                      className={`cursor-pointer transition-colors ${
                        selectedOrderId === o.id
                          ? "bg-yellow-100 hover:bg-yellow-100"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => setSelectedOrderId(o.id)}
                    >
                      <TableCell className="font-mono text-xs font-bold">{o.order_number}</TableCell>
                      <TableCell className="text-xs">{format(new Date(o.created_at), "HH:mm")}</TableCell>
                      <TableCell>
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700 border border-blue-300">
                          {statusLabels[o.status] ?? o.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{o.client_name ?? "—"}</div>
                        {o.delivery_address && (
                          <div className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                            📍 {o.delivery_address}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium text-sm">
                        ${((o.total_amount || 0) + (o.delivery_fee || 0)).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        {/* Section B: Detail panel */}
        <div className="w-3/5 overflow-hidden">
          {selectedOrder ? (
            <div className="flex flex-col h-full">
              {/* Delivery info banner */}
              {(selectedOrder.delivery_address || selectedOrder.delivery_phone) && (
                <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 space-y-1">
                  {selectedOrder.delivery_address && (
                    <div className="flex items-start gap-1.5 text-sm">
                      <MapPin className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                      <span className="font-medium text-blue-900">{selectedOrder.delivery_address}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-4">
                    {selectedOrder.delivery_phone && (
                      <div className="flex items-center gap-1 text-sm text-blue-700">
                        <Phone className="h-3.5 w-3.5" />
                        <span>{selectedOrder.delivery_phone}</span>
                      </div>
                    )}
                    {(selectedOrder.delivery_fee ?? 0) > 0 && (
                      <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                        Envío: ${(selectedOrder.delivery_fee ?? 0).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              )}
              <div className="flex-1 overflow-hidden">
                <OrderDetailPanel
                  order={selectedOrder}
                  onCheckout={(order) => setCheckoutOrder(order)}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Selecciona un domicilio para ver detalles
            </div>
          )}
        </div>
      </div>

      <NewDeliverySheet open={sheetOpen} onOpenChange={setSheetOpen} />
      {checkoutDialog}
      {rejectDialog}
    </div>
  );
}
