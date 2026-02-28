import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateOrder } from "@/hooks/useOrders";
import { useToast } from "@/hooks/use-toast";
import { useRestaurantInfo } from "@/hooks/useRestaurantInfo";
import { CustomerCombobox } from "./CustomerCombobox";
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

export function NewDeliverySheet({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const createOrder = useCreateOrder();
  const { info } = useRestaurantInfo();

  const defaultFee = info?.default_delivery_fee ?? 0;

  const [step, setStep] = useState<1 | 2>(1);
  const [customerSelection, setCustomerSelection] = useState<CustomerSelection>({ customer: null, displayName: "" });
  const [notes, setNotes] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [deliveryFee, setDeliveryFee] = useState<string>(String(defaultFee));
  const [cart, setCart] = useState<CartItem[]>([]);

  const total = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

  const resetAll = () => {
    setStep(1);
    setCustomerSelection({ customer: null, displayName: "" });
    setNotes("");
    setDeliveryAddress("");
    setDeliveryPhone("");
    setDeliveryFee(String(info?.default_delivery_fee ?? 0));
    setCart([]);
  };

  // Pre-fill phone when customer is selected
  const handleCustomerChange = (sel: CustomerSelection) => {
    setCustomerSelection(sel);
    if (sel.customer?.phone) {
      setDeliveryPhone(sel.customer.phone);
    }
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
          type: "domicilio",
          total_amount: total,
          tip_amount: 0,
          diner_count: null,
          closed_at: null,
          invoice_status: null,
          payment_method: null,
          delivery_address: deliveryAddress || null,
          delivery_phone: deliveryPhone || null,
          delivery_fee: Number(deliveryFee) || 0,
          rejection_reason: null,
          estimated_time: null,
        },
        items: cart,
      });
      toast({ title: "Domicilio creado exitosamente" });
      resetAll();
      onOpenChange(false);
    } catch (err: any) {
      const msg = err?.message || "Error desconocido";
      console.error("Error al crear domicilio:", err);
      toast({ title: "Error al crear domicilio", description: msg, variant: "destructive" });
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) resetAll(); onOpenChange(v); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="px-4 pt-4 pb-2 border-b border-border">
          <SheetTitle>{step === 1 ? "Nuevo Domicilio" : "Seleccionar Productos"}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-auto">
          {step === 1 ? (
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <Label>Cliente</Label>
                <CustomerCombobox value={customerSelection} onChange={handleCustomerChange} />
              </div>
              <div className="space-y-2">
                <Label>Dirección de Entrega *</Label>
                <Textarea
                  placeholder="Calle, barrio, indicaciones..."
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input
                    placeholder="300 123 4567"
                    value={deliveryPhone}
                    onChange={(e) => setDeliveryPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Costo Domicilio ($)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Comentario General</Label>
                <Textarea placeholder="Notas del pedido..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
              <Button
                className="w-full gap-2"
                onClick={() => setStep(2)}
                disabled={!deliveryAddress.trim()}
              >
                Continuar a Productos
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <OrderStep2
              cart={cart}
              total={total + Number(deliveryFee)}
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