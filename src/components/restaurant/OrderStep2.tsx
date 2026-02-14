import { useState } from "react";
import { Search, ArrowLeft, MessageSquare, X, Check, Minus, Plus, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useFavoriteProducts, useSearchProducts } from "@/hooks/useOrders";
import type { CartItem } from "./NewOrderSheet";
import type { Product } from "@/types/database";

interface Props {
  cart: CartItem[];
  total: number;
  onAddToCart: (item: CartItem) => void;
  onCloseOrder: () => void;
  isSubmitting: boolean;
  onBack: () => void;
}

export function OrderStep2({ cart, total, onAddToCart, onCloseOrder, isSubmitting, onBack }: Props) {
  const [search, setSearch] = useState("");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [itemNotes, setItemNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);

  const { data: favorites = [], isLoading: loadFav } = useFavoriteProducts();
  const { data: searchResults = [] } = useSearchProducts(search);

  const displayProducts = search.length >= 2 ? searchResults : [];

  const handleSelectProduct = (p: Product) => {
    setEditingProduct(p);
    setQty(1);
    setItemNotes("");
    setShowNotes(false);
  };

  const handleConfirm = () => {
    if (!editingProduct) return;
    onAddToCart({
      product_id: editingProduct.id,
      product_name: editingProduct.name,
      quantity: qty,
      unit_price: editingProduct.price,
      notes: itemNotes || null,
    });
    setEditingProduct(null);
  };

  const handleCancel = () => {
    setEditingProduct(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar producto..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {/* Item edit row */}
      {editingProduct && (
        <div className="bg-amber-100 border-b-2 border-amber-400 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-amber-900 truncate">{editingProduct.name}</p>
              <p className="text-xs text-amber-700">${editingProduct.price.toLocaleString()} c/u</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Button size="icon" variant="outline" className="h-7 w-7 border-amber-400" onClick={() => setQty(Math.max(1, qty - 1))}>
                <Minus className="h-3 w-3" />
              </Button>
              <span className="w-8 text-center font-bold text-sm">{qty}</span>
              <Button size="icon" variant="outline" className="h-7 w-7 border-amber-400" onClick={() => setQty(qty + 1)}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <Button size="icon" variant="ghost" onClick={() => setShowNotes(!showNotes)} className="text-amber-800 h-7 w-7">
              <MessageSquare className="h-4 w-4" />
            </Button>
            <Button size="icon" className="h-7 w-7 bg-green-600 hover:bg-green-700" onClick={handleConfirm}>
              <Check className="h-3 w-3 text-white" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-amber-800" onClick={handleCancel}>
              <X className="h-3 w-3" />
            </Button>
          </div>
          {showNotes && (
            <Input placeholder="Notas del ítem..." value={itemNotes} onChange={(e) => setItemNotes(e.target.value)} className="h-8 text-xs bg-white" />
          )}
        </div>
      )}

      {/* Product grid / search results */}
      <div className="flex-1 overflow-auto p-4">
        {search.length >= 2 ? (
          <div className="space-y-1">
            {displayProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sin resultados</p>
            ) : (
              displayProducts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelectProduct(p as Product)}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-muted flex justify-between items-center text-sm"
                >
                  <span>{p.name}</span>
                  <span className="text-muted-foreground">${(p as Product).price.toLocaleString()}</span>
                </button>
              ))
            )}
          </div>
        ) : (
          <>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">⭐ Favoritos</p>
            {loadFav ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : favorites.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No hay productos favoritos. Marca productos como favoritos en Admin.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {favorites.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectProduct(p as Product)}
                    className="flex flex-col items-start gap-0.5 rounded-lg border border-border bg-card p-3 text-left hover:border-primary hover:shadow-sm transition-all"
                  >
                    <span className="text-xs text-muted-foreground font-mono">#{p.id.slice(0, 6)}</span>
                    <span className="text-sm font-medium leading-tight">{p.name}</span>
                    <span className="text-xs text-primary font-semibold">${(p as Product).price.toLocaleString()}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* Cart summary */}
        {cart.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Resumen ({cart.length} ítems)</p>
            <div className="space-y-1">
              {cart.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>{item.quantity}x {item.product_name}</span>
                  <span className="font-medium">${(item.quantity * item.unit_price).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border bg-card px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-lg font-bold text-primary">${total.toLocaleString()}</p>
        </div>
        <Button onClick={onCloseOrder} disabled={cart.length === 0 || isSubmitting} className="gap-2">
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Cerrar Pedido
        </Button>
      </div>
    </div>
  );
}
