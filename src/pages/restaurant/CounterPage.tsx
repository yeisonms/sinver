import { useState } from "react";
import { Search, Plus, Loader2, ShoppingBag, CheckCircle, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOrders } from "@/hooks/useOrders";
import { useOrderItems } from "@/hooks/useOrderItems";
import { NewOrderSheet } from "@/components/restaurant/NewOrderSheet";
import { OrderDetailPanel } from "@/components/restaurant/OrderDetailPanel";
import { CheckoutDialog } from "@/components/restaurant/CheckoutDialog";
import type { Order } from "@/types/database";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const statusLabels: Record<string, string> = {
  pendiente: "Pendiente",
  en_preparacion: "En Curso",
  pendiente_online: "Nuevo",
};

export default function CounterPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [rejectOrderId, setRejectOrderId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [checkoutOrder, setCheckoutOrder] = useState<Order | null>(null);
  const [closing, setClosing] = useState(false);

  const qc = useQueryClient();

  // Inbox: pickup orders from online store
  const { data: inboxOrders = [], isLoading: loadInbox } = useOrders(["pendiente_online"]);
  const pickupInbox = inboxOrders.filter((o) => o.type === "recoger");

  const { data: allActive = [], isLoading: loadActive } = useOrders(["pendiente", "en_preparacion"]);
  const active = allActive.filter((o) => o.type !== "mesa");

  const filtered = searchTerm
    ? active.filter((o) =>
        o.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(o.order_number).includes(searchTerm)
      )
    : active;

  const selectedOrder = active.find((o) => o.id === selectedOrderId) ?? null;

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
      toast.success("Pedido cerrado y cobro registrado");
      setCheckoutOrder(null);
      setSelectedOrderId(null);
    } catch (err: any) {
      toast.error(err?.message || "Error al cerrar pedido");
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente/ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setSheetOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Nuevo Pedido
        </Button>
      </div>

      {/* Split view */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Order list (40%) */}
        <div className="w-2/5 overflow-auto border-r border-border flex flex-col">
          {/* Pickup Inbox */}
          {(pickupInbox.length > 0 || loadInbox) && (
            <div className="border-b border-border">
              <div className="px-4 py-2 bg-orange-100 flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-orange-600" />
                <span className="text-xs font-bold uppercase tracking-wide text-orange-700">
                  Pedidos Web - Recoger ({pickupInbox.length})
                </span>
              </div>
              {loadInbox ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {pickupInbox.map((o) => (
                    <div
                      key={o.id}
                      className="px-4 py-3 bg-orange-50 space-y-2 border-l-4 border-orange-500"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm">#{o.order_number}</span>
                        <span className="text-xs text-muted-foreground">
                          hace {formatDistanceToNow(new Date(o.created_at), { locale: es })}
                        </span>
                      </div>
                      <div className="text-sm font-medium">{o.client_name ?? "Cliente Web"}</div>
                      {o.delivery_phone && (
                        <div className="text-xs text-muted-foreground">📞 {o.delivery_phone}</div>
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

          {/* Active orders list */}
          <div className="flex-1 overflow-auto">
            {loadActive ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin pedidos en curso.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 text-xs">ID</TableHead>
                    <TableHead className="text-xs">Hora Inicio</TableHead>
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
                      <TableCell className="text-xs">{format(new Date(o.created_at), "dd/MM/yy HH:mm:ss")}</TableCell>
                      <TableCell>
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-700 border border-green-300">
                          {statusLabels[o.status] ?? o.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{o.client_name ?? "—"}</TableCell>
                      <TableCell className="text-right font-medium text-sm">${o.total_amount.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        {/* Right: Detail panel (60%) */}
        <div className="w-3/5 overflow-hidden">
          {selectedOrder ? (
            <OrderDetailPanel
              order={selectedOrder}
              onCheckout={(order) => setCheckoutOrder(order)}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Selecciona un pedido para ver detalles
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
        onConfirm={handleCheckout}
      />

      {/* Reject dialog */}
      <Dialog open={!!rejectOrderId} onOpenChange={(v) => { if (!v) setRejectOrderId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rechazar Pedido</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Motivo (opcional)</Label>
            <Textarea
              placeholder="Razón del rechazo..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRejectOrderId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleRejectOrder}>Confirmar Rechazo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
