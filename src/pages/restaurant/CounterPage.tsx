import { useState } from "react";
import { Search, Plus, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOrders } from "@/hooks/useOrders";
import { useOrderItems } from "@/hooks/useOrderItems";
import { NewOrderSheet } from "@/components/restaurant/NewOrderSheet";
import { OrderDetailPanel } from "@/components/restaurant/OrderDetailPanel";
import type { Order } from "@/types/database";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const statusLabels: Record<string, string> = {
  pendiente: "Pendiente",
  en_preparacion: "En Curso",
  pendiente_online: "Pendiente",
};

export default function CounterPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Checkout dialog state
  const [checkoutOrder, setCheckoutOrder] = useState<Order | null>(null);
  const [tip, setTip] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("efectivo");
  const [closing, setClosing] = useState(false);

  const qc = useQueryClient();

  const { data: allActive = [], isLoading: loadActive } = useOrders(["pendiente", "en_preparacion"]);
  const active = allActive.filter((o) => o.type !== "mesa");

  const filtered = searchTerm
    ? active.filter((o) =>
        o.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(o.order_number).includes(searchTerm)
      )
    : active;

  const selectedOrder = active.find((o) => o.id === selectedOrderId) ?? null;

  // Checkout items for total calculation
  const { data: checkoutItems = [] } = useOrderItems(checkoutOrder?.id ?? null);
  const checkoutActiveItems = checkoutItems.filter((i) => i.status !== "cancelado");
  const consumedTotal = checkoutActiveItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const tipAmount = parseFloat(tip) || 0;
  const grandTotal = consumedTotal + tipAmount;

  const handleCheckout = async () => {
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
        amount: grandTotal,
        method: paymentMethod,
      });
      if (payErr) throw payErr;

      const { error: orderErr } = await supabase
        .from("orders")
        .update({
          status: "cerrado",
          total_amount: consumedTotal,
          tip_amount: tipAmount,
          closed_at: new Date().toISOString(),
          payment_method: paymentMethod,
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

  const openCheckout = (order: Order) => {
    setTip("0");
    setPaymentMethod("efectivo");
    setCheckoutOrder(order);
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
        <div className="w-2/5 overflow-auto border-r border-border">
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

        {/* Right: Detail panel (60%) */}
        <div className="w-3/5 overflow-hidden">
          {selectedOrder ? (
            <OrderDetailPanel
              order={selectedOrder}
              onCheckout={openCheckout}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Selecciona un pedido para ver detalles
            </div>
          )}
        </div>
      </div>

      <NewOrderSheet open={sheetOpen} onOpenChange={setSheetOpen} />

      {/* Checkout Dialog */}
      <Dialog open={!!checkoutOrder} onOpenChange={(v) => { if (!v) setCheckoutOrder(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cerrar Pedido</DialogTitle>
            <DialogDescription>Pedido #{checkoutOrder?.order_number}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">Total Consumido</span>
              <span className="text-lg font-bold">${consumedTotal.toLocaleString()}</span>
            </div>
            <div>
              <Label className="text-xs">Propina (opcional)</Label>
              <Input type="number" min={0} value={tip} onChange={(e) => setTip(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label className="text-xs">Método de Pago</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">💵 Efectivo</SelectItem>
                  <SelectItem value="tarjeta">💳 Tarjeta</SelectItem>
                  <SelectItem value="transferencia">🏦 Transferencia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between py-3 border-t border-border bg-muted/50 -mx-6 px-6 rounded-b-lg">
              <span className="font-semibold">Total a Pagar</span>
              <span className="text-xl font-bold text-primary">${grandTotal.toLocaleString()}</span>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCheckout} disabled={closing} className="w-full">
              {closing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Cobrar y Cerrar Pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
