import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateOrder } from "@/hooks/useOrders";
import { useToast } from "@/hooks/use-toast";
import { OrderStep1 } from "./OrderStep1";
import { OrderStep2 } from "./OrderStep2";
import type { OrderItem } from "@/types/database";

export interface CartItem extends Omit<OrderItem, "id" | "order_id"> {}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewOrderSheet({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const createOrder = useCreateOrder();

  const [step, setStep] = useState<1 | 2>(1);
  const [clientName, setClientName] = useState("");
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);

  const total = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

  const resetAll = () => {
    setStep(1);
    setClientName("");
    setNotes("");
    setCart([]);
  };

  const handleAddToCart = (item: CartItem) => {
    setCart((prev) => {
      const existing = prev.findIndex((c) => c.product_id === item.product_id && c.notes === item.notes);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], quantity: updated[existing].quantity + item.quantity };
        return updated;
      }
      return [...prev, item];
    });
  };

  const handleCloseOrder = async () => {
    try {
      await createOrder.mutateAsync({
        order: {
          table_id: null,
          waiter_id: user?.id ?? null,
          client_name: clientName || null,
          general_notes: notes || null,
          status: "pendiente",
          type: "recoger",
          total_amount: total,
          tip_amount: 0,
        },
        items: cart,
      });
      toast({ title: "Pedido creado exitosamente" });
      resetAll();
      onOpenChange(false);
    } catch {
      toast({ title: "Error al crear pedido", variant: "destructive" });
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) resetAll(); onOpenChange(v); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="px-4 pt-4 pb-2 border-b border-border">
          <SheetTitle>{step === 1 ? "Nuevo Pedido" : "Seleccionar Productos"}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-auto">
          {step === 1 ? (
            <OrderStep1
              clientName={clientName}
              setClientName={setClientName}
              notes={notes}
              setNotes={setNotes}
              userId={user?.email ?? "—"}
              onContinue={() => setStep(2)}
            />
          ) : (
            <OrderStep2
              cart={cart}
              total={total}
              onAddToCart={handleAddToCart}
              onCloseOrder={handleCloseOrder}
              isSubmitting={createOrder.isPending}
              onBack={() => setStep(1)}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
