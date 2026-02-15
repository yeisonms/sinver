import { useCart } from "@/contexts/CartContext";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

function formatPrice(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CartPanel({ open, onClose }: Props) {
  const { items, removeItem, subtotal, deliveryMethod } = useCart();
  const navigate = useNavigate();

  const deliveryFee = deliveryMethod === "delivery" ? 1000 : 0;
  const total = subtotal + deliveryFee;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="p-5 pb-3">
          <SheetTitle>Mi pedido</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 space-y-4">
          {items.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Tu carrito está vacío.</p>
          ) : (
            items.map((item) => (
              <div key={item.id} className="space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{item.product_name}</p>
                    {item.modifiers.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {item.modifiers.map((m) => `(x${item.quantity}) ${m.option_name}`).join(", ")}
                      </p>
                    )}
                    {item.notes && <p className="text-xs text-muted-foreground italic">"{item.notes}"</p>}
                    <p className="text-sm font-bold text-primary">
                      (x{item.quantity}) {formatPrice((item.unit_price + item.extras_total) * item.quantity)}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="shrink-0" onClick={() => removeItem(item.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-border p-5 space-y-3">
            <h3 className="font-bold">Resumen</h3>
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            {deliveryMethod === "delivery" && (
              <div className="flex justify-between text-sm">
                <span>Envío</span>
                <span>{formatPrice(deliveryFee)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span className="text-primary">{formatPrice(total)}</span>
            </div>
            <Button
              className="w-full"
              size="lg"
              onClick={() => {
                onClose();
                navigate("/menu/checkout");
              }}
            >
              Continuar
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
