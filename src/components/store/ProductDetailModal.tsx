import { useState, useEffect } from "react";
import { useProductModifierGroups } from "@/hooks/useModifiers";
import { useCart } from "@/contexts/CartContext";
import type { Product, SelectedModifier, ModifierOption } from "@/types/database";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Minus, Plus } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

function formatPrice(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);
}

interface Props {
  product: Product;
  onClose: () => void;
}

export default function ProductDetailModal({ product, onClose }: Props) {
  const { addItem } = useCart();
  const { data: modifierGroups = [] } = useProductModifierGroups(product.id);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  // selections: groupId -> optionId[]
  const [selections, setSelections] = useState<Record<string, string[]>>({});

  // Reset when product changes
  useEffect(() => {
    setQuantity(1);
    setNotes("");
    setSelections({});
  }, [product.id]);

  const toggleOption = (groupId: string, optionId: string, maxSel: number) => {
    setSelections((prev) => {
      const current = prev[groupId] || [];
      if (maxSel === 1) {
        return { ...prev, [groupId]: [optionId] };
      }
      if (current.includes(optionId)) {
        return { ...prev, [groupId]: current.filter((id) => id !== optionId) };
      }
      if (current.length >= maxSel) return prev;
      return { ...prev, [groupId]: [...current, optionId] };
    });
  };

  // Calculate extras
  const selectedModifiers: SelectedModifier[] = [];
  let extrasTotal = 0;
  for (const group of modifierGroups) {
    const sel = selections[group.id] || [];
    for (const optId of sel) {
      const opt = group.options.find((o) => o.id === optId);
      if (opt) {
        selectedModifiers.push({
          group_id: group.id,
          group_name: group.public_name || group.name,
          option_id: opt.id,
          option_name: opt.name,
          price_extra: opt.price_extra,
        });
        extrasTotal += opt.price_extra;
      }
    }
  }

  const totalPrice = (product.price + extrasTotal) * quantity;

  // Validate required groups
  const isValid = modifierGroups.every((g) => {
    const sel = selections[g.id] || [];
    return sel.length >= g.min_selection;
  });

  const handleAdd = () => {
    addItem({
      product_id: product.id,
      product_name: product.name,
      image_url: product.image_url,
      quantity,
      unit_price: product.price,
      extras_total: extrasTotal,
      notes,
      modifiers: selectedModifiers,
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-0">
        {product.image_url && (
          <div className="w-full h-48 overflow-hidden">
            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-5 space-y-5">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg">{product.name}</DialogTitle>
              <span className="text-primary font-bold">{formatPrice(product.price)}</span>
            </div>
            {product.description && <p className="text-sm text-muted-foreground mt-1">{product.description}</p>}
          </DialogHeader>

          {/* Quantity */}
          <div className="flex items-center justify-center gap-4 border border-border rounded-lg py-2">
            <Button variant="ghost" size="icon" onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1}>
              <Minus className="w-4 h-4" />
            </Button>
            <span className="text-lg font-bold w-8 text-center">{quantity}</span>
            <Button variant="ghost" size="icon" onClick={() => setQuantity(quantity + 1)}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Modifier groups */}
          {modifierGroups.map((group) => {
            const sel = selections[group.id] || [];
            const isSingle = group.max_selection === 1;
            return (
              <div key={group.id} className="space-y-2">
                <div>
                  <h4 className="font-semibold text-sm">{group.public_name || group.name}</h4>
                  <p className="text-xs text-muted-foreground">
                    Selecciona {group.min_selection === group.max_selection
                      ? `${group.min_selection}`
                      : `entre ${group.min_selection} y ${group.max_selection}`}{" "}
                    {group.max_selection === 1 ? "opción" : "opciones"}
                    {group.min_selection > 0 && <span className="text-destructive ml-1">*</span>}
                  </p>
                </div>
                {isSingle ? (
                  <RadioGroup value={sel[0] || ""} onValueChange={(v) => toggleOption(group.id, v, 1)}>
                    {group.options.map((opt) => (
                      <div key={opt.id} className="flex items-center justify-between py-1.5">
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value={opt.id} id={`opt-${opt.id}`} />
                          <Label htmlFor={`opt-${opt.id}`} className="text-sm cursor-pointer">{opt.name}</Label>
                        </div>
                        {opt.price_extra > 0 && <span className="text-xs text-muted-foreground">+{formatPrice(opt.price_extra)}</span>}
                      </div>
                    ))}
                  </RadioGroup>
                ) : (
                  <div className="space-y-1">
                    {group.options.map((opt) => (
                      <div key={opt.id} className="flex items-center justify-between py-1.5">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`opt-${opt.id}`}
                            checked={sel.includes(opt.id)}
                            onCheckedChange={() => toggleOption(group.id, opt.id, group.max_selection)}
                            disabled={!sel.includes(opt.id) && sel.length >= group.max_selection}
                          />
                          <Label htmlFor={`opt-${opt.id}`} className="text-sm cursor-pointer">{opt.name}</Label>
                        </div>
                        {opt.price_extra > 0 && <span className="text-xs text-muted-foreground">+{formatPrice(opt.price_extra)}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Notes */}
          <div className="space-y-1">
            <h4 className="font-semibold text-sm">Comentarios</h4>
            <Textarea
              placeholder="Agrega comentarios"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[60px]"
            />
          </div>

          {/* Add button */}
          <Button className="w-full" size="lg" disabled={!isValid} onClick={handleAdd}>
            Agregar a mi pedido · {formatPrice(totalPrice)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
