import { useState, useEffect } from "react";
import { Search, ArrowLeft, MessageSquare, X, Check, Minus, Plus, Loader2, Trash2, ShoppingCart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFavoriteProducts, useSearchProducts } from "@/hooks/useOrders";
import { useProductModifierGroups } from "@/hooks/useModifiers";
import { useCategories } from "@/hooks/useCategories";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import type { CartItem } from "./NewOrderSheet";
import type { Product, SelectedModifier } from "@/types/database";

interface Props {
  cart: CartItem[];
  existingItems?: CartItem[];
  total: number;
  onAddToCart: (item: CartItem) => void;
  onRemoveFromCart: (index: number) => void;
  onUpdateCartItem: (index: number, updated: CartItem) => void;
  onCloseOrder: () => void;
  isSubmitting: boolean;
  onBack: () => void;
  mode?: "counter" | "mesa";
}

export function OrderStep2({ cart, existingItems = [], total, onAddToCart, onRemoveFromCart, onUpdateCartItem, onCloseOrder, isSubmitting, onBack, mode = "counter" }: Props) {
  const [search, setSearch] = useState("");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [itemNotes, setItemNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [editingCartIndex, setEditingCartIndex] = useState<number | null>(null);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, SelectedModifier>>({});
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  const isMobile = useIsMobile();
  const { role } = useAuth();
  const { data: favorites = [], isLoading: loadFav } = useFavoriteProducts();
  const { data: searchResults = [] } = useSearchProducts(search);
  const { data: modifierGroups = [] } = useProductModifierGroups(editingProduct?.id ?? null);
  const { data: categories = [] } = useCategories();

  // Fetch products by category
  const { data: categoryProducts = [] } = useQuery<Product[]>({
    queryKey: ["products-by-category", activeCategoryId],
    queryFn: async () => {
      if (!activeCategoryId) return [];
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("category_id", activeCategoryId)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!activeCategoryId,
  });

  const displayProducts = search.length >= 2 ? searchResults : [];

  // Reset modifiers when product changes
  useEffect(() => {
    if (editingProduct && editingCartIndex === null) {
      setSelectedModifiers({});
    }
  }, [editingProduct?.id]);

  const handleSelectProduct = (p: Product) => {
    if (isMobile) {
      // On mobile, add directly with qty 1
      const cartItem: CartItem = {
        product_id: p.id,
        product_name: p.name,
        quantity: 1,
        unit_price: p.price,
        notes: null,
        modifiers: [],
      };
      onAddToCart(cartItem);
      return;
    }
    setEditingProduct(p);
    setQty(1);
    setItemNotes("");
    setShowNotes(false);
    setEditingCartIndex(null);
    setSelectedModifiers({});
  };

  const handleEditCartItem = (index: number) => {
    const item = cart[index];
    setEditingProduct({ id: item.product_id, name: item.product_name, price: item.unit_price } as Product);
    setQty(item.quantity);
    setItemNotes(item.notes || "");
    setShowNotes(!!item.notes);
    setEditingCartIndex(index);
    const mods: Record<string, SelectedModifier> = {};
    (item.modifiers || []).forEach((m) => { mods[m.group_id] = m; });
    setSelectedModifiers(mods);
  };

  const handleModifierChange = (groupId: string, optionId: string) => {
    const group = modifierGroups.find((g) => g.id === groupId);
    const option = group?.options.find((o) => o.id === optionId);
    if (!group || !option) return;
    setSelectedModifiers((prev) => ({
      ...prev,
      [groupId]: {
        group_id: groupId,
        group_name: group.name,
        option_id: option.id,
        option_name: option.name,
        price_extra: option.price_extra,
      },
    }));
  };

  const modifierExtra = Object.values(selectedModifiers).reduce((sum, m) => sum + m.price_extra, 0);

  const handleConfirm = () => {
    if (!editingProduct) return;
    const cartItem: CartItem = {
      product_id: editingProduct.id,
      product_name: editingProduct.name,
      quantity: qty,
      unit_price: editingProduct.price + modifierExtra,
      notes: itemNotes || null,
      modifiers: Object.values(selectedModifiers),
    };
    if (editingCartIndex !== null) {
      onUpdateCartItem(editingCartIndex, cartItem);
    } else {
      onAddToCart(cartItem);
    }
    setEditingProduct(null);
    setEditingCartIndex(null);
    setSelectedModifiers({});
  };

  const handleCancel = () => {
    setEditingProduct(null);
    setEditingCartIndex(null);
    setSelectedModifiers({});
  };

  const itemTotal = editingProduct ? qty * (editingProduct.price + modifierExtra) : 0;
  const existingTotal = existingItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);

  // Mobile layout
  if (isMobile) {
    // Mobile cart view (full screen overlay)
    if (showMobileCart) {
      return (
        <div className="flex flex-col h-full bg-background">
          <div className="bg-primary text-primary-foreground h-14 flex items-center px-4 gap-3 shrink-0">
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-white/20" onClick={() => setShowMobileCart(false)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h2 className="font-bold">Pedido</h2>
              <p className="text-xs opacity-80">En Curso</p>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-4">
            {/* Existing items */}
            {existingItems.length > 0 && (
              <div className="bg-muted/50 rounded-xl p-4 space-y-2">
                <p className="text-sm font-semibold text-muted-foreground">Confirmados</p>
                {existingItems.map((item, i) => (
                  <div key={`ex-${i}`} className="flex items-center justify-between text-sm">
                    <span>{item.quantity} {item.product_name}</span>
                    <span className="font-medium">{(item.quantity * item.unit_price).toLocaleString("es-CO", { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>
            )}

            {/* New cart items */}
            {cart.length > 0 ? (
              <div className="bg-accent/30 rounded-xl p-4 space-y-2">
                <p className="text-sm font-semibold">Pendiente</p>
                {cart.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex-1">
                      <span>{item.quantity} {item.product_name}</span>
                      <span className="ml-2 text-muted-foreground">{(item.quantity * item.unit_price).toLocaleString("es-CO", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <button onClick={() => onRemoveFromCart(i)} className="text-muted-foreground hover:text-destructive p-1">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <div className="flex justify-between font-bold text-sm pt-2 border-t border-border">
                  <span>Total a confirmar</span>
                  <span>{total.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1 h-11" onClick={() => setShowMobileCart(false)}>
                    Cancelar
                  </Button>
                  <Button className="flex-1 h-11 font-semibold" onClick={onCloseOrder} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Confirmar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <p>Sin productos agregados</p>
                <button onClick={() => setShowMobileCart(false)} className="text-primary text-sm mt-2 font-medium">
                  + Adicionar productos
                </button>
              </div>
            )}
          </div>

          {/* Bottom action */}
          <div className="border-t border-border p-4 bg-card">
            <Button
              className="w-full h-12 text-base font-semibold"
              onClick={onCloseOrder}
              disabled={cart.length === 0 || isSubmitting}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {mode === "mesa" ? "Enviar a Cocina" : "Cerrar Pedido"}
            </Button>
          </div>
        </div>
      );
    }

    // Mobile product selection view
    return (
      <div className="flex flex-col h-full">
        {/* Search bar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-navbar">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 text-navbar-foreground hover:bg-white/10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar producto..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-white" />
          </div>
        </div>

        {/* Category tabs - horizontal scroll */}
        {!search && (
          <div className="flex items-center gap-0 border-b border-border bg-muted/30 overflow-x-auto px-1">
            <button
              onClick={() => setActiveCategoryId(null)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                !activeCategoryId
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground"
              }`}
            >
              Favoritos
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategoryId(cat.id)}
                className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeCategoryId === cat.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Product list */}
        <div className="flex-1 overflow-auto">
          {search.length >= 2 ? (
            <div className="divide-y divide-border">
              {displayProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sin resultados</p>
              ) : (
                displayProducts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectProduct(p as Product)}
                    className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-muted/50 active:bg-muted"
                  >
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">$ {(p as Product).price.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full border-2 border-border flex items-center justify-center shrink-0">
                      <Plus className="h-5 w-5 text-foreground" />
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : activeCategoryId ? (
            <div className="divide-y divide-border">
              {categoryProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sin productos en esta categoría</p>
              ) : (
                categoryProducts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectProduct(p)}
                    className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-muted/50 active:bg-muted"
                  >
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">$ {p.price.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full border-2 border-border flex items-center justify-center shrink-0">
                      <Plus className="h-5 w-5 text-foreground" />
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : (
            /* Favorites */
            <div className="divide-y divide-border">
              {loadFav ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : favorites.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No hay favoritos. Marca productos en Admin.</p>
              ) : (
                favorites.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectProduct(p as Product)}
                    className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-muted/50 active:bg-muted"
                  >
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">$ {(p as Product).price.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full border-2 border-border flex items-center justify-center shrink-0">
                      <Plus className="h-5 w-5 text-foreground" />
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Floating cart button */}
        <div className="border-t border-border p-3 bg-card">
          <Button
            className="w-full h-12 text-base font-semibold gap-2"
            onClick={() => setShowMobileCart(true)}
          >
            <ShoppingCart className="h-5 w-5" />
            {mode === "mesa" ? "Confirmar" : "Confirmar"}
            {cart.length > 0 && (
              <span className="ml-1">({cart.length}) — ${total.toLocaleString()}</span>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Desktop layout (unchanged)
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
        <div className="border-b-2 border-amber-400">
          <div className="bg-amber-100 px-3 py-2 flex items-center gap-2">
            <Button size="icon" variant="outline" className="h-8 w-8 shrink-0 border-amber-300 bg-amber-50" onClick={() => setQty(Math.max(1, qty - 1))}>
              <Minus className="h-3 w-3" />
            </Button>
            <span className="w-7 text-center font-bold text-sm">{qty}</span>
            <Button size="icon" variant="outline" className="h-8 w-8 shrink-0 border-amber-300 bg-amber-50" onClick={() => setQty(qty + 1)}>
              <Plus className="h-3 w-3" />
            </Button>
            <span className="flex-1 text-sm font-medium truncate">{editingProduct.name}</span>
            <span className="text-sm font-semibold shrink-0">$ {itemTotal.toLocaleString()}</span>
            <Button size="icon" variant="ghost" onClick={() => setShowNotes(!showNotes)} className="h-8 w-8 shrink-0 text-amber-800">
              <MessageSquare className="h-4 w-4" />
            </Button>
            <Button size="icon" className="h-8 w-8 shrink-0 bg-green-600 hover:bg-green-700" onClick={handleConfirm}>
              <Check className="h-3.5 w-3.5 text-white" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive" onClick={handleCancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          {showNotes && (
            <div className="bg-amber-50 px-3 py-2 border-t border-amber-200">
              <Input placeholder="Comentario del ítem..." value={itemNotes} onChange={(e) => setItemNotes(e.target.value)} className="h-8 text-xs bg-white" />
            </div>
          )}
          {modifierGroups.length > 0 && (
            <div className="bg-amber-50 px-3 py-2 border-t border-amber-200 space-y-2">
              {modifierGroups.map((group) => (
                <Select key={group.id} value={selectedModifiers[group.id]?.option_id || ""} onValueChange={(val) => handleModifierChange(group.id, val)}>
                  <SelectTrigger className="h-8 text-xs bg-white">
                    <SelectValue placeholder={`--- ${group.public_name || group.name} ---`} />
                  </SelectTrigger>
                  <SelectContent>
                    {group.options.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.name} {opt.price_extra > 0 ? `(+$${opt.price_extra.toLocaleString()})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ))}
            </div>
          )}
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

        {/* Existing items (for mesa re-entry) */}
        {existingItems.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">🕒 Pedidos anteriores ({existingItems.length})</p>
            <div className="space-y-1">
              {existingItems.map((item, i) => (
                <div key={`existing-${i}`} className="flex items-center gap-2 text-sm py-1 text-muted-foreground">
                  <span className="flex-1">{item.quantity}x {item.product_name}</span>
                  <span className="font-medium shrink-0">${(item.quantity * item.unit_price).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cart summary with edit/delete */}
        {cart.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {mode === "mesa" ? "🆕 Nueva comanda" : "Resumen"} ({cart.length} ítems)
            </p>
            <div className="space-y-1">
              {cart.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm py-1 group">
                  <button onClick={() => handleEditCartItem(i)} className="flex-1 text-left hover:text-primary transition-colors">
                    <span>{item.quantity}x {item.product_name}</span>
                    {item.modifiers && item.modifiers.length > 0 && (
                      <span className="text-xs text-muted-foreground ml-1">
                        [{item.modifiers.map((m) => m.option_name).join(", ")}]
                      </span>
                    )}
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
          <p className="text-xs text-muted-foreground">{mode === "mesa" ? "Nueva comanda" : "Total"}</p>
          <p className="text-lg font-bold text-primary">${total.toLocaleString()}</p>
        </div>
        <Button onClick={onCloseOrder} disabled={cart.length === 0 || isSubmitting} className="gap-2">
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === "mesa" ? "Enviar a Cocina" : "Cerrar Pedido"}
        </Button>
      </div>
    </div>
  );
}
