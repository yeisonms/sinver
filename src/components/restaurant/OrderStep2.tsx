import { useState } from "react";
import { Search, ArrowLeft, MessageSquare, X, Check, Minus, Plus, Loader2, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useFavoriteProducts, useSearchProducts } from "@/hooks/useOrders";
import type { CartItem } from "./NewOrderSheet";
import type { Product } from "@/types/database";

interface Props {
  cart: CartItem[];
  total: number;
  onAddToCart: (item: CartItem) => void;
  onRemoveFromCart: (index: number) => void;
  onUpdateCartItem: (index: number, updated: CartItem) => void;
  onCloseOrder: () => void;
  isSubmitting: boolean;
  onBack: () => void;
}

export function OrderStep2({ cart, total, onAddToCart, onRemoveFromCart, onUpdateCartItem, onCloseOrder, isSubmitting, onBack }: Props) {
  const [search, setSearch] = useState("");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [itemNotes, setItemNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [editingCartIndex, setEditingCartIndex] = useState<number | null>(null);

  const { data: favorites = [], isLoading: loadFav } = useFavoriteProducts();
  const { data: searchResults = [] } = useSearchProducts(search);

  const displayProducts = search.length >= 2 ? searchResults : [];

  const handleSelectProduct = (p: Product) => {
    setEditingProduct(p);
    setQty(1);
    setItemNotes("");
    setShowNotes(false);
    setEditingCartIndex(null);
  };

  const handleEditCartItem = (index: number) => {
    const item = cart[index];
    setEditingProduct({ id: item.product_id, name: item.product_name, price: item.unit_price } as Product);
    setQty(item.quantity);
    setItemNotes(item.notes || "");
    setShowNotes(!!item.notes);
    setEditingCartIndex(index);
  };

  const handleConfirm = () => {
    if (!editingProduct) return;
    const cartItem: CartItem = {
      product_id: editingProduct.id,
      product_name: editingProduct.name,
      quantity: qty,
      unit_price: editingProduct.price,
      notes: itemNotes || null,
    };
    if (editingCartIndex !== null) {
      onUpdateCartItem(editingCartIndex, cartItem);
    } else {
      onAddToCart(cartItem);
    }
    setEditingProduct(null);
    setEditingCartIndex(null);
  };

  const handleCancel = () => {
    setEditingProduct(null);
    setEditingCartIndex(null);
  };

  const itemTotal = editingProduct ? qty * editingProduct.price : 0;

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

      {/* Item edit row - matching reference image */}
      {editingProduct && (
        <div className="border-b-2 border-amber-400">
          <div className="bg-amber-100 px-3 py-2 flex items-center gap-2">
            {/* Quantity controls */}
            <Button size="icon" variant="outline" className="h-8 w-8 shrink-0 border-amber-300 bg-amber-50" onClick={() => setQty(Math.max(1, qty - 1))}>
              <Minus className="h-3 w-3" />
            </Button>
            <span className="w-7 text-center font-bold text-sm">{qty}</span>
            <Button size="icon" variant="outline" className="h-8 w-8 shrink-0 border-amber-300 bg-amber-50" onClick={() => setQty(qty + 1)}>
              <Plus className="h-3 w-3" />
            </Button>

            {/* Product name */}
            <span className="flex-1 text-sm font-medium truncate">{editingProduct.name}</span>

            {/* Price */}
            <span className="text-sm font-semibold shrink-0">$ {itemTotal.toLocaleString()}</span>

            {/* Notes toggle */}
            <Button size="icon" variant="ghost" onClick={() => setShowNotes(!showNotes)} className="h-8 w-8 shrink-0 text-amber-800">
              <MessageSquare className="h-4 w-4" />
            </Button>

            {/* Confirm */}
            <Button size="icon" className="h-8 w-8 shrink-0 bg-green-600 hover:bg-green-700" onClick={handleConfirm}>
              <Check className="h-3.5 w-3.5 text-white" />
            </Button>

            {/* Cancel / Delete */}
            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive" onClick={handleCancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Notes input */}
          {showNotes && (
            <div className="bg-amber-50 px-3 py-2 border-t border-amber-200">
              <Input placeholder="Comentario del ítem..." value={itemNotes} onChange={(e) => setItemNotes(e.target.value)} className="h-8 text-xs bg-white" />
            </div>
          )}

          {/* Total to confirm */}
          <div className="bg-amber-50 px-3 py-1.5 border-t border-amber-200">
            <p className="text-xs font-semibold text-amber-800">Total a confirmar: ${itemTotal.toLocaleString()}</p>
          </div>
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

        {/* Cart summary with edit/delete */}
        {cart.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Resumen ({cart.length} ítems)</p>
            <div className="space-y-1">
              {cart.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm py-1 group">
                  <button onClick={() => handleEditCartItem(i)} className="flex-1 text-left hover:text-primary transition-colors">
                    <span>{item.quantity}x {item.product_name}</span>
                    {item.notes && <span className="text-xs text-muted-foreground ml-1">({item.notes})</span>}
                  </button>
                  <span className="font-medium shrink-0">${(item.quantity * item.unit_price).toLocaleString()}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive transition-opacity"
                    onClick={() => onRemoveFromCart(i)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
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
