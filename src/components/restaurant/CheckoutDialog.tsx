import { useState, useEffect } from "react";
import { Loader2, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

// ✏️ Porcentaje de propina por defecto — cambia este valor para ajustar globalmente
const DEFAULT_TIP_RATE = 0.02; // 2%

const paymentMethods = [
  { value: "efectivo", label: "Efectivo", emoji: "💵" },
  { value: "tarjeta_credito", label: "Tarj. Crédito", emoji: "💳" },
  { value: "tarjeta_debito", label: "Tarj. Débito", emoji: "💳" },
  { value: "transferencia", label: "Transferencia", emoji: "🏦" },
];

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  consumedTotal: number;
  closing: boolean;
  tipRate?: number;
  onConfirm: (data: {
    tipAmount: number;
    paymentMethod: string;
    grandTotal: number;
  }) => void;
}

export function CheckoutDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  consumedTotal,
  closing,
  tipRate = DEFAULT_TIP_RATE,
  onConfirm,
}: CheckoutDialogProps) {
  const [includeTip, setIncludeTip] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("efectivo");
  const [paidWith, setPaidWith] = useState("");
  const isMobile = useIsMobile();

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setIncludeTip(false);
      setPaymentMethod("efectivo");
      setPaidWith("");
    }
  }, [open]);

  const tipPercent = Math.round(tipRate * 100);
  const tipAmount = includeTip ? Math.round(consumedTotal * tipRate) : 0;
  const grandTotal = consumedTotal + tipAmount;

  const paidAmount = parseFloat(paidWith) || 0;
  const change = paidAmount - grandTotal;

  const isCash = paymentMethod === "efectivo";
  const canSubmit = isCash ? paidAmount >= grandTotal : true;

  const checkoutContent = (
    <div className="space-y-5">
      {/* Payment method tiles */}
      <div>
        <p className="text-sm font-medium text-muted-foreground mb-3">Selecciona el medio de pago</p>
        <div className="grid grid-cols-2 gap-3">
          {paymentMethods.map((m) => (
            <button
              key={m.value}
              onClick={() => { setPaymentMethod(m.value); setPaidWith(""); }}
              className={`flex flex-col items-start justify-center p-4 rounded-xl border-2 transition-all min-h-[72px] ${
                paymentMethod === m.value
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-card hover:border-muted-foreground/30"
              }`}
            >
              <span className="text-base font-medium">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Cash Calculator */}
      {isCash && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium">Importe recibido</Label>
            <Input
              type="number"
              min={0}
              value={paidWith}
              onChange={(e) => setPaidWith(e.target.value)}
              placeholder="0"
              className="mt-1 h-12 text-lg"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Vuelto</Label>
            <p className={`text-2xl font-bold mt-2 ${
              paidAmount === 0 ? "text-muted-foreground" : change >= 0 ? "text-green-600" : "text-destructive"
            }`}>
              $ {change >= 0 ? change.toLocaleString("es-CO", { minimumFractionDigits: 1 }) : `(${Math.abs(change).toLocaleString()})`}
            </p>
          </div>
        </div>
      )}

      {/* Tip section */}
      <div>
        <p className="text-sm font-medium text-muted-foreground mb-3">Registra tu propina</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setIncludeTip(true)}
            className={`flex flex-col items-start justify-center p-4 rounded-xl border-2 transition-all min-h-[72px] ${
              includeTip
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-muted-foreground/30"
            }`}
          >
            <span className="text-lg font-bold">{tipPercent} %</span>
            <span className="text-xs text-primary">Efectivo</span>
          </button>
          <button
            onClick={() => setIncludeTip(false)}
            className={`flex flex-col items-start justify-center p-4 rounded-xl border-2 transition-all min-h-[72px] ${
              !includeTip
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-muted-foreground/30"
            }`}
          >
            <span className="text-base font-medium">Sin propina</span>
          </button>
        </div>
        <button className="flex items-center gap-1.5 text-sm text-primary mt-3 mx-auto">
          <Pencil className="h-3.5 w-3.5" />
          Editar propina
        </button>
      </div>

      {/* Totals */}
      <div className="border-t border-border pt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span>Cobro total</span>
          <span className="font-medium">${consumedTotal.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</span>
        </div>
        {includeTip && (
          <div className="flex justify-between text-sm">
            <span>Propina</span>
            <span className="font-medium">${tipAmount.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</span>
          </div>
        )}
        <div className="flex justify-between text-lg font-bold pt-1">
          <span>Total a cobrar</span>
          <span>${grandTotal.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</span>
        </div>
      </div>
    </div>
  );

  const confirmButton = (
    <Button
      onClick={() => onConfirm({ tipAmount, paymentMethod, grandTotal })}
      disabled={closing || !canSubmit}
      className="w-full h-12 text-base font-semibold"
    >
      {closing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
      Cobrar
    </Button>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[95vh]">
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </DrawerHeader>
          <div className="px-4 pb-2 overflow-auto flex-1">{checkoutContent}</div>
          <DrawerFooter>{confirmButton}</DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
        </DialogHeader>
        {checkoutContent}
        <DialogFooter>
          {confirmButton}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
