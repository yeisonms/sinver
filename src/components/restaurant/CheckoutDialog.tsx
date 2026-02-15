import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

// ✏️ Porcentaje de propina por defecto — cambia este valor para ajustar globalmente
const DEFAULT_TIP_RATE = 0.02; // 2%

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-4">
          {/* Total Consumido */}
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-sm text-muted-foreground">Total Consumido</span>
            <span className="text-lg font-bold">
              ${consumedTotal.toLocaleString()}
            </span>
          </div>

          {/* Propina Switch */}

          {/* Propina Switch */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="tip-switch" className="text-sm cursor-pointer">
                Incluir Servicio Voluntario ({tipPercent}%)
              </Label>
              <Switch
                id="tip-switch"
                checked={includeTip}
                onCheckedChange={setIncludeTip}
              />
            </div>
            {includeTip && (
              <div className="flex items-center justify-between px-3 py-1.5 rounded-md bg-muted/60">
                <span className="text-xs text-muted-foreground">Propina ({tipPercent}%)</span>
                <span className="text-sm font-semibold">
                  +${tipAmount.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Total Final */}
          <div className="flex items-center justify-between py-3 border-y border-border">
            <span className="font-semibold">Total a Pagar</span>
            <span className="text-xl font-bold text-primary">
              ${grandTotal.toLocaleString()}
            </span>
          </div>

          {/* Método de Pago */}
          <div>
            <Label className="text-xs">Método de Pago</Label>
            <Select value={paymentMethod} onValueChange={(v) => {
              setPaymentMethod(v);
              setPaidWith("");
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="efectivo">💵 Efectivo</SelectItem>
                <SelectItem value="tarjeta">💳 Tarjeta</SelectItem>
                <SelectItem value="transferencia">🏦 Transferencia</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Cash Calculator */}
          {isCash && (
            <div className="space-y-3 rounded-lg border border-border p-3 bg-muted/30">
              <div>
                <Label className="text-xs">Paga con</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input
                    type="number"
                    min={0}
                    value={paidWith}
                    onChange={(e) => setPaidWith(e.target.value)}
                    placeholder="0"
                    className="pl-7"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Cambio / Devolución</span>
                <span
                  className={`text-xl font-bold ${
                    paidAmount === 0
                      ? "text-muted-foreground"
                      : change >= 0
                        ? "text-green-600"
                        : "text-destructive"
                  }`}
                >
                  ${change >= 0 ? change.toLocaleString() : `(${Math.abs(change).toLocaleString()})`}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={() => onConfirm({ tipAmount, paymentMethod, grandTotal })}
            disabled={closing || !canSubmit}
            className="w-full"
          >
            {closing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Cobrar{isCash && paidAmount > 0 ? ` — Cambio $${change.toLocaleString()}` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
