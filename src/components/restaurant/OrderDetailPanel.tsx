import { useState } from "react";
import { Search, Plus, Check, Pencil, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useFavoriteProducts, useSearchProducts } from "@/hooks/useOrders";
import { useOrderItems, useCancelOrderItem, type OrderItemRow } from "@/hooks/useOrderItems";
import type { Order, Product } from "@/types/database";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

interface Props {
  order: Order;
  waiterName?: string;
  onCheckout: (order: Order) => void;
}

export function OrderDetailPanel({ order, waiterName, onCheckout }: Props) {
  const navigate = useNavigate();
  const [cancelItem, setCancelItem] = useState<OrderItemRow | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const { data: items = [], isLoading: loadingItems } = useOrderItems(order.id);
  const cancelItemMut = useCancelOrderItem();

  const activeItems = items.filter((i) => i.status !== "cancelado");
  const cancelledItems = items.filter((i) => i.status === "cancelado");
  const activeTotal = activeItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);

  const handleAddProductsClick = () => {
    if (order.type === "recoger") {
      navigate(`/restaurant/counter/${order.id}/take-order`);
    } else if (order.type === "domicilio") {
      navigate(`/restaurant/delivery/${order.id}/take-order`);
    } else {
      navigate(`/restaurant/tables/${order.id}/take-order`);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelItem || !cancelReason.trim()) return;
    await cancelItemMut.mutateAsync({
      itemId: cancelItem.id,
      reason: cancelReason.trim(),
      orderId: order.id,
    });
    setCancelItem(null);
    setCancelReason("");
  };

  return (
    <div className="flex flex-col h-full bg-card rounded-2xl overflow-hidden relative">
      {/* Refined Header */}
      <div className="bg-primary/10 text-primary px-6 py-4 flex items-center justify-between border-b border-primary/10">
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-widest font-semibold opacity-80">Orden Activa</span>
          <span className="font-bold text-xl tracking-tight">#{order.order_number}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" className="h-9 w-9 text-primary hover:bg-primary/20 hover:text-primary rounded-full transition-colors">
            <Check className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-9 w-9 text-primary hover:bg-primary/20 hover:text-primary rounded-full transition-colors">
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Info blocks with better typography */}
      <div className="px-6 py-5 space-y-3 border-b border-border/50 text-sm bg-background/30">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground font-medium">Hora Inicio</span>
          <span className="font-semibold text-foreground">{format(new Date(order.created_at), "dd/MM/yy HH:mm")}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground font-medium">Mesero</span>
          <span className="font-semibold text-foreground">{waiterName || "—"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground font-medium">Cliente</span>
          <span className="font-semibold text-foreground">{order.client_name || "—"}</span>
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="text-muted-foreground font-medium">Seguimiento</span>
          <button className="text-primary font-semibold text-xs uppercase tracking-wide hover:text-primary/80 transition-colors">
            Ver Detalles
          </button>
        </div>
      </div>

      {/* Primary Action Section */}
      <div className="p-6 pb-2">
        <Button
          className="w-full h-12 gap-2 font-bold bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary border-2 border-primary/20 shadow-sm rounded-xl transition-all"
          variant="outline"
          onClick={handleAddProductsClick}
        >
          <Plus className="h-5 w-5" />
          Añadir Productos
        </Button>
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-auto px-6 py-2">
        {loadingItems ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary/40" /></div>
        ) : activeItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <p className="text-sm font-medium">La orden está vacía</p>
          </div>
        ) : (
          <div className="space-y-3 mt-2">
            {activeItems.map((item) => (
              <div key={item.id} className="flex items-start gap-3 py-3 border-b border-border/40 last:border-0 group">
                <div className="bg-secondary/50 text-foreground font-bold text-sm w-8 h-8 rounded-lg flex items-center justify-center shrink-0">
                  {item.quantity}
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <p className="text-sm font-semibold text-foreground leading-tight">{item.product_name}</p>
                  {item.notes && <p className="text-xs text-muted-foreground mt-1 italic leading-snug">{item.notes}</p>}
                </div>
                <div className="flex flex-col items-end gap-2 pt-1">
                  <span className="text-sm font-bold text-foreground">${(item.quantity * item.unit_price).toLocaleString()}</span>
                  <button
                    onClick={() => { setCancelItem(item); setCancelReason(""); }}
                    className="text-muted-foreground/50 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                    title="Cancelar item"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            {cancelledItems.map((item) => (
              <div key={item.id} className="flex items-start gap-3 py-3 opacity-50 grayscale border-b border-border/20">
                <div className="bg-secondary/30 text-muted-foreground font-bold text-sm w-8 h-8 rounded-lg flex items-center justify-center shrink-0">
                  {item.quantity}
                </div>
                <div className="flex-1 min-w-0 pt-1 line-through">
                  <p className="text-sm font-medium">{item.product_name}</p>
                  {item.cancellation_reason && <p className="text-[11px] text-destructive no-underline font-medium mt-1">{item.cancellation_reason}</p>}
                </div>
                <span className="text-sm font-medium pt-1 line-through">${(item.quantity * item.unit_price).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer sticky bottom */}
      <div className="border-t border-border/50 px-6 py-5 bg-background/50 backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <span className="font-semibold text-sm text-muted-foreground uppercase tracking-widest">Total a Pagar</span>
          <span className="text-3xl font-bold tracking-tight text-foreground">${activeTotal.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="h-12 flex-1 rounded-xl text-sm font-medium border-border/60 hover:bg-secondary/50 transition-colors">
            % Descuento
          </Button>
          <Button
            className="h-12 flex-[2] rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-base shadow-premium hover:shadow-premium-hover transition-all"
            onClick={() => onCheckout(order)}
            disabled={activeTotal === 0}
          >
            Cobrar Orden
          </Button>
        </div>
      </div>

      {/* Cancel confirmation dialog */}
      <Dialog open={!!cancelItem} onOpenChange={(v) => { if (!v) setCancelItem(null); }}>
        <DialogContent className="sm:max-w-sm rounded-2xl border-0 shadow-premium">
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-bold tracking-tight mb-2">
              Cancelar Producto
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-center text-muted-foreground mb-4">¿Estás seguro de que deseas cancelar este producto de la orden?</p>
          <div className="space-y-2 mb-4">
            <Label className="text-xs font-semibold text-foreground/80 uppercase tracking-wider">Motivo de Cancelación</Label>
            <Textarea
              placeholder="Ej. El cliente cambió de opinión..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              className="resize-none rounded-xl bg-secondary/30 border-border/50 focus:border-primary/50 transition-colors"
            />
          </div>
          <DialogFooter className="gap-3 sm:gap-0 flex-col sm:flex-row">
            <Button variant="ghost" className="w-full sm:w-auto rounded-xl h-11" onClick={() => setCancelItem(null)}>Atrás</Button>
            <Button
              className="w-full sm:w-auto rounded-xl h-11 bg-destructive hover:bg-destructive/90 text-white shadow-soft"
              disabled={!cancelReason.trim() || cancelItemMut.isPending}
              onClick={handleConfirmCancel}
            >
              {cancelItemMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
