import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateOrder } from "@/hooks/useOrders";
import { useToast } from "@/hooks/use-toast";
import { OrderStep1 } from "./OrderStep1";
import { OrderStep2 } from "./OrderStep2";
import type { OrderItem, Customer } from "@/types/database";

export interface CartItem extends Omit<OrderItem, "id" | "order_id"> {}

interface CustomerSelection {
  customer: Customer | null;
  displayName: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewOrderSheet({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const createOrder = useCreateOrder();

  const [step, setStep] = useState<1 | 2>(1);
  const [customerSelection, setCustomerSelection] = useState<CustomerSelection>({ customer: null, displayName: "" });
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);

  const total = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

  const resetAll = () => {
    setStep(1);
    setCustomerSelection({ customer: null, displayName: "" });
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

  const handleRemoveFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateCartItem = (index: number, updated: CartItem) => {
    setCart((prev) => prev.map((item, i) => (i === index ? updated : item)));
  };

  const handleCloseOrder = async () => {
    try {
      await createOrder.mutateAsync({
        order: {
          table_id: null,
          waiter_id: null,
          client_name: customerSelection.displayName || null,
          customer_id: customerSelection.customer?.id || null,
          general_notes: notes || null,
          status: "pendiente",
          type: "recoger",
          total_amount: total,
          tip_amount: 0,
          diner_count: null,
        },
        items: cart,
      });
      toast({ title: "Pedido creado exitosamente" });
      resetAll();
      onOpenChange(false);
    } catch (err: any) {
      const msg = err?.message || "Error desconocido";
      console.error("Error al crear pedido:", err);
      toast({ title: "Error al crear pedido", description: msg, variant: "destructive" });
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
              customerSelection={customerSelection}
              setCustomerSelection={setCustomerSelection}
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
              onRemoveFromCart={handleRemoveFromCart}
              onUpdateCartItem={handleUpdateCartItem}
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
