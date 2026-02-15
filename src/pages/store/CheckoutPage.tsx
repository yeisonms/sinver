import { useState } from "react";
import { useCart } from "@/contexts/CartContext";
import { useRestaurantInfo } from "@/hooks/useRestaurantInfo";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Trash2, ArrowLeft, CheckCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

function formatPrice(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);
}

export default function CheckoutPage() {
  const { items, subtotal, deliveryMethod, removeItem, clearCart } = useCart();
  const { info } = useRestaurantInfo();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [orderNumber, setOrderNumber] = useState<number | null>(null);

  const [form, setForm] = useState({
    email: "",
    name: "",
    phone: "",
    address: "",
    paymentMethod: "efectivo",
  });

  const deliveryFee = deliveryMethod === "delivery" ? 5000 : 0;
  const total = subtotal + deliveryFee;

  const isFormValid = form.name.trim() && form.phone.trim().length >= 7 && (deliveryMethod !== "delivery" || form.address.trim());

  const handleSubmit = async () => {
    if (!isFormValid || items.length === 0) return;
    setSubmitting(true);
    try {
      // Create order
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          client_name: form.name.trim(),
          delivery_phone: form.phone.trim(),
          delivery_address: deliveryMethod === "delivery" ? form.address.trim() : null,
          delivery_fee: deliveryMethod === "delivery" ? deliveryFee : 0,
          status: "pendiente_online",
          type: deliveryMethod === "delivery" ? "domicilio" : "recoger",
          total_amount: total,
          tip_amount: 0,
          payment_method: form.paymentMethod,
          general_notes: form.email ? `Email: ${form.email}` : null,
        } as any)
        .select("id, order_number")
        .single();

      if (orderErr) throw orderErr;

      // Create order items (exclude product_name and modifiers)
      const orderItems = items.map((item) => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price + item.extras_total,
        notes: [
          item.notes,
          item.modifiers.length > 0 ? item.modifiers.map((m) => m.option_name).join(", ") : null,
        ].filter(Boolean).join(" | ") || null,
        status: "activo",
      }));

      const { error: itemsErr } = await supabase.from("order_items").insert(orderItems);
      if (itemsErr) throw itemsErr;

      setOrderNumber(order.order_number);
      clearCart();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // Success screen
  if (orderNumber !== null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4 max-w-sm">
          <CheckCircle className="w-16 h-16 text-primary mx-auto" />
          <h1 className="text-2xl font-bold">¡Gracias!</h1>
          <p className="text-muted-foreground">
            Tu pedido <span className="font-bold text-foreground">#{orderNumber}</span> fue recibido correctamente.
          </p>
          <p className="text-sm text-muted-foreground">Te avisaremos cuando esté listo.</p>
          <Button onClick={() => navigate("/menu")} className="mt-4">Volver a la tienda</Button>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Tu carrito está vacío.</p>
          <Button onClick={() => navigate("/menu")}>Volver a la tienda</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mini header */}
      <header className="sticky top-0 z-20 bg-background border-b border-border px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <h1 className="text-lg font-bold">{info?.description || "Mi Restaurante"}</h1>
          <span className="text-xs px-2 py-0.5 bg-destructive text-destructive-foreground rounded-full">
            {deliveryMethod === "pickup" ? "Para retirar" : "Domicilio"}
          </span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-4 grid grid-cols-1 md:grid-cols-[1fr_360px] gap-8">
        {/* Form */}
        <div className="space-y-6">
          <h2 className="font-bold text-sm flex items-center gap-2">👤 Datos generales</h2>

          <div className="space-y-4">
            <div>
              <Label className="text-sm">Correo electrónico</Label>
              <Input placeholder="ejemplo@gmail.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">Nombre y apellido *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label className="text-sm">Número de teléfono *</Label>
                <Input placeholder="321 1234567" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>

            <div>
              <Label className="text-sm">
                Dirección {deliveryMethod === "delivery" ? "de entrega *" : "(opcional)"}
              </Label>
              <Input
                placeholder={deliveryMethod === "delivery" ? "Calle, número, barrio" : "Dirección del cliente (opcional)"}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
          </div>

          <Separator />

          <h2 className="font-bold text-sm flex items-center gap-2">💳 Forma de pago *</h2>
          <RadioGroup value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v })}>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="efectivo" id="pay-cash" />
                <Label htmlFor="pay-cash">Efectivo</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="transferencia" id="pay-transfer" />
                <Label htmlFor="pay-transfer">Transferencia</Label>
              </div>
            </div>
          </RadioGroup>

          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => navigate("/menu")}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Atrás
            </Button>
            <Button className="flex-1" disabled={!isFormValid || submitting} onClick={handleSubmit}>
              {submitting ? "Enviando..." : "Confirmar pedido"}
            </Button>
          </div>
        </div>

        {/* Order summary sidebar */}
        <aside className="border border-border rounded-lg p-5 self-start sticky top-20 space-y-4">
          <h3 className="font-bold">Mi pedido</h3>
          {items.map((item) => (
            <div key={item.id} className="space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="font-semibold text-sm">{item.product_name}</p>
                  {item.modifiers.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {item.modifiers.map((m) => `(x${item.quantity}) ${m.option_name}`).join(", ")}
                    </p>
                  )}
                  <p className="text-sm font-bold text-primary">
                    (x{item.quantity}) {formatPrice((item.unit_price + item.extras_total) * item.quantity)}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => removeItem(item.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
          <Separator />
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatPrice(subtotal)}</span></div>
            {deliveryMethod === "delivery" && (
              <div className="flex justify-between"><span>Envío</span><span>{formatPrice(deliveryFee)}</span></div>
            )}
          </div>
          <Separator />
          <div className="flex justify-between font-bold">
            <span>Total</span><span className="text-primary">{formatPrice(total)}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
