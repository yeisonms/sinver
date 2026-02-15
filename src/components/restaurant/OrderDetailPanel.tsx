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
import { useOrderItems, useAddOrderItem, useCancelOrderItem, type OrderItemRow } from "@/hooks/useOrderItems";
import type { Order, Product } from "@/types/database";
import { format } from "date-fns";

interface Props {
  order: Order;
  waiterName?: string;
  onCheckout: (order: Order) => void;
}

export function OrderDetailPanel({ order, waiterName, onCheckout }: Props) {
  const [search, setSearch] = useState("");
  const [cancelItem, setCancelItem] = useState<OrderItemRow | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const { data: items = [], isLoading: loadingItems } = useOrderItems(order.id);
  const { data: favorites = [], isLoading: loadFav } = useFavoriteProducts();
  const { data: searchResults = [] } = useSearchProducts(search);
  const addItem = useAddOrderItem();
  const cancelItemMut = useCancelOrderItem();

  const displayProducts = search.length >= 2 ? searchResults : [];

  const activeItems = items.filter((i) => i.status !== "cancelado");
  const cancelledItems = items.filter((i) => i.status === "cancelado");
  const activeTotal = activeItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);

  const handleAddProduct = async (p: Product) => {
    await addItem.mutateAsync({
      orderId: order.id,
      productId: p.id,
      quantity: 1,
      unitPrice: p.price,
    });
    // Also update the order total
    const { supabase } = await import("@/integrations/supabase/client");
    const newTotal = activeTotal + p.price;
    await supabase.from("orders").update({ total_amount: newTotal }).eq("id", order.id);
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
    <div className="flex flex-col h-full border-l border-border">
      {/* Orange header */}
      <div className="bg-orange-500 text-white px-4 py-3 flex items-center justify-between">
        <span className="font-bold text-sm">ID #{order.order_number}</span>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-orange-600">
            <Check className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-orange-600">
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Info blocks */}
      <div className="px-4 py-3 space-y-1.5 border-b border-border text-sm">
        <div className="flex gap-2">
          <span className="text-muted-foreground w-24 shrink-0">Hora Inicio</span>
          <span className="font-medium">{format(new Date(order.created_at), "dd/MM/yy HH:mm:ss")}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-muted-foreground w-24 shrink-0">Mesero</span>
          <span className="font-medium">{waiterName || "—"}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-muted-foreground w-24 shrink-0">Cliente</span>
          <span className="font-medium">{order.client_name || "—"}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-muted-foreground w-24 shrink-0">Seguimiento</span>
          <span className="text-orange-600 underline cursor-pointer text-xs">Ver pedido</span>
        </div>
      </div>

      {/* ADICIONAR section */}
      <div className="border-b border-border">
        <div className="flex items-center justify-between px-4 py-2 bg-muted/50">
          <span className="text-xs font-bold uppercase tracking-wide">Adicionar</span>
        </div>
        <div className="px-4 py-2 flex items-center gap-2">
          <Button size="icon" className="h-8 w-8 bg-orange-500 hover:bg-orange-600 shrink-0">
            <Plus className="h-4 w-4 text-white" />
          </Button>
          <div className="relative flex-1">
            <Input
              placeholder="Buscar producto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
        </div>

        {/* Product grid */}
        <div className="px-4 pb-3 max-h-40 overflow-auto">
          {search.length >= 2 ? (
            displayProducts.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">Sin resultados</p>
            ) : (
              <div className="grid grid-cols-4 gap-1.5">
                {displayProducts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleAddProduct(p as Product)}
                    disabled={addItem.isPending}
                    className="text-left rounded border border-border bg-card px-2 py-1.5 text-[11px] leading-tight hover:border-orange-400 hover:shadow-sm transition-all truncate"
                  >
                    <span className="text-muted-foreground font-mono">{(p as Product).price.toLocaleString()} </span>
                    {p.name}
                  </button>
                ))}
              </div>
            )
          ) : loadFav ? (
            <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="grid grid-cols-4 gap-1.5">
              {favorites.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleAddProduct(p as Product)}
                  disabled={addItem.isPending}
                  className="text-left rounded border border-border bg-card px-2 py-1.5 text-[11px] leading-tight hover:border-orange-400 hover:shadow-sm transition-all truncate"
                >
                  <span className="text-muted-foreground font-mono">{(p as Product).price.toLocaleString()} </span>
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-auto px-4 py-2">
        {loadingItems ? (
          <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : activeItems.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Sin productos</p>
        ) : (
          <div className="space-y-1">
            {activeItems.map((item) => (
              <div key={item.id} className="flex items-start gap-2 py-2 border-b border-border last:border-0">
                <span className="text-sm font-bold w-6 shrink-0">{item.quantity}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{item.product_name}</p>
                  {item.notes && <p className="text-xs text-muted-foreground">{item.notes}</p>}
                </div>
                <span className="text-sm font-medium shrink-0">${(item.quantity * item.unit_price).toLocaleString()}</span>
                <button
                  onClick={() => { setCancelItem(item); setCancelReason(""); }}
                  className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            {cancelledItems.map((item) => (
              <div key={item.id} className="flex items-start gap-2 py-2 opacity-40 line-through">
                <span className="text-sm w-6 shrink-0">{item.quantity}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{item.product_name}</p>
                  {item.cancellation_reason && <p className="text-xs text-destructive">{item.cancellation_reason}</p>}
                </div>
                <span className="text-sm shrink-0">${(item.quantity * item.unit_price).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold text-sm">Total:</span>
          <span className="text-lg font-bold">${activeTotal.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs">% Aplicar Descuento</Button>
          <Button
            size="sm"
            className="ml-auto bg-orange-500 hover:bg-orange-600 text-white"
            onClick={() => onCheckout(order)}
          >
            Cerrar Pedido
          </Button>
        </div>
      </div>

      {/* Cancel confirmation dialog */}
      <Dialog open={!!cancelItem} onOpenChange={(v) => { if (!v) setCancelItem(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center bg-muted -mx-6 -mt-6 px-6 py-3 rounded-t-lg font-bold uppercase tracking-wide">
              Confirmación
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-center py-2">¿Seguro desea cancelar esta adición?</p>
          <div className="space-y-2">
            <Label className="text-xs">Comentario</Label>
            <Textarea
              placeholder="Comentario"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              className="border-orange-300 focus:border-orange-500"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCancelItem(null)}>Cancelar</Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white"
              disabled={!cancelReason.trim() || cancelItemMut.isPending}
              onClick={handleConfirmCancel}
            >
              {cancelItemMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Aceptar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
