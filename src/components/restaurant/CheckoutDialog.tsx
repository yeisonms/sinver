import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";



interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  consumedTotal: number;
  closing: boolean;
  /** Porcentaje de propina sugerida (ej: 2 para 2%). Si no se pasa se usa 0. */
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
  tipRate = 0,
  onConfirm,
}: CheckoutDialogProps) {
  const { data: methods = [], isLoading: isLoadingMethods } = useQuery({
    queryKey: ["active-payment-methods"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_methods")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
    enabled: open,
  });

  const [paymentMethod, setPaymentMethod] = useState("");
  const [paidWith, setPaidWith] = useState("");
  const [tipInput, setTipInput] = useState("");
  const [tipEnabled, setTipEnabled] = useState(true);
  const [tipInitialized, setTipInitialized] = useState(false);
  const isMobile = useIsMobile();

  const suggestedTip = Math.round(consumedTotal * (tipRate / 100));

  // Reset everything when dialog opens/closes
  useEffect(() => {
    if (open) {
      // We will set default method when methods load
      setPaidWith("");
      setTipInitialized(false);
      setTipEnabled(tipRate > 0);
      setTipInput("");
    }
  }, [open]);

  // Set default payment method once loaded
  useEffect(() => {
    if (open && methods.length > 0 && !paymentMethod) {
      setPaymentMethod(methods[0].name);
    }
  }, [open, methods, paymentMethod]);

  // Initialize tip as soon as suggestedTip is available (items may load after dialog opens)
  useEffect(() => {
    if (open && !tipInitialized && tipRate > 0 && consumedTotal > 0) {
      const calculated = Math.round(consumedTotal * (tipRate / 100));
      setTipInitialized(true);
      setTipEnabled(true);
      setTipInput(String(calculated));
    }
  }, [open, tipRate, consumedTotal, tipInitialized]);

  const tipAmount = tipEnabled ? Math.max(0, parseFloat(tipInput) || 0) : 0;
  const grandTotal = consumedTotal + tipAmount;

  const paidAmount = parseFloat(paidWith) || 0;
  const change = paidAmount - grandTotal;

  // Consider "efectivo" matching dynamic for change calculator
  const isCash = paymentMethod.toLowerCase() === "efectivo";
  const canSubmit = isCash ? paidAmount >= grandTotal : !!paymentMethod;

  const checkoutContent = (
    <div className="space-y-5">
      {/* Payment method tiles */}
      <div>
        <p className="text-sm font-medium text-muted-foreground mb-3">Selecciona el medio de pago</p>
        <div className="grid grid-cols-2 gap-3">
          {isLoadingMethods ? (
            <div className="col-span-2 flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : methods.length === 0 ? (
            <div className="col-span-2 text-sm text-muted-foreground text-center py-2">
              No hay métodos de pago configurados.
            </div>
          ) : (
            methods.map((m) => (
              <button
                key={m.id}
                onClick={() => { setPaymentMethod(m.name); setPaidWith(""); }}
                className={`flex flex-col items-start justify-center p-4 rounded-xl border-2 transition-all min-h-[72px] ${paymentMethod === m.name
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-card hover:border-muted-foreground/30"
                  }`}
              >
                <span className="text-base font-medium capitalize">{m.name}</span>
              </button>
            ))
          )}
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
            <p className={`text-2xl font-bold mt-2 ${paidAmount === 0 ? "text-muted-foreground" : change >= 0 ? "text-green-600" : "text-destructive"
              }`}>
              $ {change >= 0 ? change.toLocaleString("es-CO", { minimumFractionDigits: 1 }) : `(${Math.abs(change).toLocaleString()})`}
            </p>
          </div>
        </div>
      )}

      {/* Tip section — toggle + editable input */}
      <div className="space-y-2 rounded-xl border border-border p-3 bg-muted/30">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">
            Propina ({tipRate}%)
          </Label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{tipEnabled ? "Sí" : "No"}</span>
            <Switch
              checked={tipEnabled}
              onCheckedChange={(v) => {
                setTipEnabled(v);
                if (v && tipInput === "") setTipInput(String(suggestedTip));
              }}
            />
          </div>
        </div>
        {tipEnabled && (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-sm font-medium text-muted-foreground">$</span>
            <Input
              type="number"
              min={0}
              value={tipInput}
              onChange={(e) => setTipInput(e.target.value)}
              placeholder="0"
              className="h-10 text-base"
            />
            {suggestedTip > 0 && tipInput !== String(suggestedTip) && (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 text-xs"
                onClick={() => setTipInput(String(suggestedTip))}
              >
                Sugerida
              </Button>
            )}
          </div>
        )}
        {!tipEnabled && (
          <p className="text-xs text-muted-foreground">Sin propina para este cobro.</p>
        )}
      </div>

      {/* Totals */}
      <div className="border-t border-border pt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span>Cobro total</span>
          <span className="font-medium">${consumedTotal.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</span>
        </div>
        {tipAmount > 0 && (
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
