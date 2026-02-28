import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Minus, Plus, Scissors } from "lucide-react";
import type { OrderItemRow } from "@/hooks/useOrderItems";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface SplitBillDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orderId: string;
    items: OrderItemRow[];
    onSplitSuccess: (newOrderId: string) => void;
}

export function SplitBillDialog({ open, onOpenChange, orderId, items, onSplitSuccess }: SplitBillDialogProps) {
    const qc = useQueryClient();
    const [splitQuantities, setSplitQuantities] = useState<Record<string, number>>({});
    const [isSplitting, setIsSplitting] = useState(false);

    // Solo consideramos items activos
    const activeItems = useMemo(() => items.filter((i) => i.status !== "cancelado"), [items]);

    // Reset counters when dialog opens
    useEffect(() => {
        if (open) {
            setSplitQuantities({});
        }
    }, [open, items]);

    const handleIncrement = (itemId: string, maxQty: number) => {
        setSplitQuantities((prev) => {
            const current = prev[itemId] || 0;
            if (current >= maxQty) return prev;
            return { ...prev, [itemId]: current + 1 };
        });
    };

    const handleDecrement = (itemId: string) => {
        setSplitQuantities((prev) => {
            const current = prev[itemId] || 0;
            if (current <= 0) return prev;
            return { ...prev, [itemId]: current - 1 };
        });
    };

    const totalToSeparate = useMemo(() => {
        let total = 0;
        Object.entries(splitQuantities).forEach(([itemId, qty]) => {
            if (qty > 0) {
                const item = activeItems.find((i) => i.id === itemId);
                if (item) total += qty * item.unit_price;
            }
        });
        return total;
    }, [splitQuantities, activeItems]);

    const totalSelectedItems = Object.values(splitQuantities).reduce((acc, q) => acc + q, 0);
    const totalOriginalItems = activeItems.reduce((acc, item) => acc + item.quantity, 0);

    const handleConfirmSplit = async () => {
        if (totalSelectedItems === 0) {
            toast.error("Debes seleccionar al menos un producto para dividir la cuenta.");
            return;
        }

        if (totalSelectedItems === totalOriginalItems) {
            toast.error("No puedes separar todos los productos. Para eso, simplemente cobra el pedido original completo.");
            return;
        }

        setIsSplitting(true);
        try {
            const splitPayload = Object.entries(splitQuantities)
                .filter(([_, qty]) => qty > 0)
                .map(([itemId, qty]) => ({
                    order_item_id: itemId,
                    split_qty: qty,
                }));

            // Call the RPC
            const { data: newOrderId, error } = await supabase.rpc("split_order_items", {
                original_order_id: orderId,
                split_items: splitPayload,
            });

            if (error) throw error;
            if (!newOrderId) throw new Error("No se pudo generar el pedido dividido.");

            toast.success("Cuenta dividida exitosamente.");
            qc.invalidateQueries({ queryKey: ["orders"] });
            qc.invalidateQueries({ queryKey: ["order-items"] });
            qc.invalidateQueries({ queryKey: ["tables"] });

            onSplitSuccess(newOrderId);
            onOpenChange(false);
        } catch (e: any) {
            toast.error(e.message || "Error al dividir la cuenta");
        } finally {
            setIsSplitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
                    <DialogTitle className="flex items-center gap-2">
                        <Scissors className="h-5 w-5 text-orange-500" />
                        Dividir Cuenta por Productos
                    </DialogTitle>
                    <DialogDescription>
                        Selecciona la cantidad de cada producto que deseas trasladar a una cuenta separada para pagar ahora mismo.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-auto px-6 py-2 space-y-3">
                    {activeItems.map((item) => {
                        const currentSplitQty = splitQuantities[item.id!] || 0;
                        return (
                            <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-muted/50 rounded-md border border-border">
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-sm truncate">{item.product_name}</p>
                                    <p className="text-xs text-muted-foreground">${item.unit_price.toLocaleString()} c/u</p>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <span className="text-xs text-muted-foreground w-12 text-center">De {item.quantity}</span>
                                    <div className="flex items-center bg-background border border-border rounded-full h-8 w-[100px] overflow-hidden">
                                        <button
                                            type="button"
                                            disabled={currentSplitQty === 0}
                                            onClick={() => handleDecrement(item.id!)}
                                            className="flex-1 h-full flex items-center justify-center hover:bg-muted active:bg-muted/80 disabled:opacity-50 transition-colors"
                                        >
                                            <Minus className="h-3.5 w-3.5" />
                                        </button>
                                        <span className="flex-1 h-full flex items-center justify-center text-sm font-bold border-x border-border">
                                            {currentSplitQty}
                                        </span>
                                        <button
                                            type="button"
                                            disabled={currentSplitQty >= item.quantity}
                                            onClick={() => handleIncrement(item.id!, item.quantity)}
                                            className="flex-1 h-full flex items-center justify-center hover:bg-muted active:bg-muted/80 disabled:opacity-50 transition-colors"
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <DialogFooter className="px-6 py-4 bg-muted/30 border-t border-border shrink-0 flex flex-col sm:flex-row gap-3 sm:items-center">
                    <div className="flex-1">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total a Separar</p>
                        <p className="text-xl font-bold text-green-600">${totalToSeparate.toLocaleString()}</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSplitting}>
                            Cancelar
                        </Button>
                        <Button onClick={handleConfirmSplit} disabled={isSplitting || totalSelectedItems === 0} className="bg-orange-600 text-white hover:bg-orange-700">
                            {isSplitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Scissors className="h-4 w-4 mr-2" />}
                            Cobrar Selección
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
