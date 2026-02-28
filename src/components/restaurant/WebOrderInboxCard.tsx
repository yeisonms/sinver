import { useState } from "react";
import { CheckCircle, XCircle, MessageCircle, Clock, MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { reprintOrder } from "@/lib/printService";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import type { Order } from "@/types/database";

const REJECT_REASONS = [
  "Producto Agotado",
  "Fuera de Cobertura",
  "Cancelado por el cliente",
  "Otro",
];

interface Props {
  order: Order;
  restaurantName?: string;
  compact?: boolean;
}

export function WebOrderInboxCard({ order, restaurantName, compact }: Props) {
  const [actionState, setActionState] = useState<"none" | "accept" | "reject">("none");
  const [estimatedTime, setEstimatedTime] = useState(15);
  const [rejectReason, setRejectReason] = useState("");
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  const handleConfirmAccept = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: "en_preparacion", estimated_time: estimatedTime })
        .eq("id", order.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Pedido aceptado");
      await reprintOrder(order.id);
      setActionState("none");
    } catch (err: any) {
      toast.error(err?.message || "Error al aceptar");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectReason) {
      toast.error("Selecciona un motivo de rechazo");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: "cancelado", rejection_reason: rejectReason })
        .eq("id", order.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Pedido rechazado");
      setActionState("none");
    } catch (err: any) {
      toast.error(err?.message || "Error al rechazar");
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsApp = () => {
    const phone = order.delivery_phone?.replace(/\D/g, "") || "";
    if (!phone) {
      toast.error("Este pedido no tiene teléfono registrado");
      return;
    }
    const deliveryType = order.type === "domicilio" ? "Domicilio" : "Retiro en local";
    const message = `Hola ${order.client_name || "Cliente"}, confirmamos tu pedido #${order.order_number}\n\n*Tipo de entrega:* ${deliveryType}\n*Tiempo estimado:* ${estimatedTime} minutos\n\n• *Total: $${order.total_amount.toLocaleString()}*\n\n¡Gracias por tu compra!\n${restaurantName || ""}`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  const o = order;

  return (
    <div className="px-4 py-3 space-y-2 border-l-4 border-l-primary hover:bg-white/50 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="font-bold text-base text-foreground">#{o.order_number}</span>
        <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
          hace {formatDistanceToNow(new Date(o.created_at), { locale: es })}
        </span>
      </div>

      {/* Client & details */}
      <div className="text-sm font-medium text-foreground/80">{o.client_name ?? "Cliente Web"}</div>
      {o.delivery_phone && (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Phone className="h-3.5 w-3.5" /> {o.delivery_phone}
        </div>
      )}
      {o.delivery_address && (
        <div className="flex items-start gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
          <span className="truncate">{o.delivery_address}</span>
        </div>
      )}

      {/* Total + action buttons */}
      <div className="flex items-center justify-between">
        <span className="font-bold text-lg text-foreground">${o.total_amount.toLocaleString()}</span>
        {actionState === "none" && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              className="h-9 px-3 rounded-lg text-xs gap-1.5"
              onClick={() => { setActionState("reject"); setRejectReason(""); }}
            >
              <XCircle className="h-4 w-4" /> Rechazar
            </Button>
            <Button
              size="sm"
              className="h-9 px-3 rounded-lg text-xs gap-1.5"
              onClick={() => setActionState("accept")}
            >
              <CheckCircle className="h-4 w-4" /> Aceptar
            </Button>
          </div>
        )}
      </div>

      {/* Accept form */}
      {actionState === "accept" && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-3 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-green-600" />
            <Label className="text-sm font-semibold text-green-800">Tiempo estimado (minutos)</Label>
          </div>
          <Input
            type="number"
            min={1}
            value={estimatedTime}
            onChange={(e) => setEstimatedTime(parseInt(e.target.value) || 15)}
            className="h-10 w-32 text-center text-lg font-bold border-green-300 focus-visible:ring-green-500"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setActionState("none")} disabled={loading}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
              onClick={handleConfirmAccept}
              disabled={loading}
            >
              <CheckCircle className="h-4 w-4" />
              {loading ? "Guardando..." : "Confirmar Aceptación"}
            </Button>
          </div>
        </div>
      )}

      {/* Reject form */}
      {actionState === "reject" && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-3 animate-in slide-in-from-top-2 duration-200">
          <Label className="text-sm font-semibold text-red-800">Motivo de rechazo</Label>
          <Select value={rejectReason} onValueChange={setRejectReason}>
            <SelectTrigger className="border-red-300 focus:ring-red-500">
              <SelectValue placeholder="Selecciona un motivo..." />
            </SelectTrigger>
            <SelectContent>
              {REJECT_REASONS.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setActionState("none")} disabled={loading}>
              Cancelar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="gap-1.5"
              onClick={handleConfirmReject}
              disabled={loading}
            >
              <XCircle className="h-4 w-4" />
              {loading ? "Guardando..." : "Confirmar Rechazo"}
            </Button>
          </div>
        </div>
      )}

      {/* WhatsApp button */}
      {o.delivery_phone && (
        <Button
          size="sm"
          className="w-full h-9 bg-[#25D366] hover:bg-[#1da851] text-white gap-2 rounded-lg text-xs font-semibold"
          onClick={handleWhatsApp}
        >
          <MessageCircle className="h-4 w-4" />
          Enviar WhatsApp al Cliente
        </Button>
      )}
    </div>
  );
}
