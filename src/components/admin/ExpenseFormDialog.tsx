import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface ExpenseFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export function ExpenseFormDialog({ open, onOpenChange, onSuccess }: ExpenseFormDialogProps) {
    const queryClient = useQueryClient();
    const [amount, setAmount] = useState("");
    const [expenseDate, setExpenseDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    const [categoryId, setCategoryId] = useState("");
    const [provider, setProvider] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("");
    const [receiptType, setReceiptType] = useState("");
    const [notes, setNotes] = useState("");
    const [registerId, setRegisterId] = useState("null"); // 'null' string represents standalone expense

    // Fetch Categories
    const { data: categories = [] } = useQuery({
        queryKey: ["expense-categories"],
        queryFn: async () => {
            const { data, error } = await supabase.from("expense_categories").select("*").order("name");
            if (error) throw error;
            return data;
        },
        enabled: open,
    });

    // Fetch Payment Methods
    const { data: paymentMethods = [] } = useQuery({
        queryKey: ["payment-methods"],
        queryFn: async () => {
            const { data, error } = await supabase.from("payment_methods").select("*").eq("is_active", true);
            if (error) throw error;
            return data;
        },
        enabled: open,
    });

    // Fetch Open Cash Registers
    const { data: registers = [] } = useQuery({
        queryKey: ["open-cash-registers"],
        queryFn: async () => {
            const { data, error } = await supabase.from("cash_registers").select("*").eq("status", "open").order("opened_at", { ascending: false });
            if (error) throw error;
            return data;
        },
        enabled: open,
    });

    // Auto-select first open register if available
    useEffect(() => {
        if (open && registers.length > 0 && registerId === "null") {
            setRegisterId(registers[0].id);
        }
    }, [open, registers]);

    const resetForm = () => {
        setAmount("");
        setExpenseDate(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
        setCategoryId("");
        setProvider("");
        setPaymentMethod("");
        setReceiptType("");
        setNotes("");
        setRegisterId(registers.length > 0 ? registers[0].id : "null");
    };

    const createMutation = useMutation({
        mutationFn: async () => {
            if (!amount || !categoryId || !paymentMethod) {
                throw new Error("Por favor completa los campos obligatorios (*)");
            }

            const { error } = await supabase.from("expenses").insert({
                amount: parseFloat(amount),
                expense_date: new Date(expenseDate).toISOString(),
                category_id: categoryId,
                provider: provider || null,
                payment_method: paymentMethod,
                receipt_type: receiptType || null,
                notes: notes || null,
                cash_register_id: registerId === "null" ? null : registerId,
            });

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["expenses"] });
            queryClient.invalidateQueries({ queryKey: ["cash-registers"] });
            toast.success("Gasto registrado exitosamente");
            resetForm();
            onSuccess?.();
            onOpenChange(false);
        },
        onError: (err: any) => {
            toast.error(err.message || "Error al registrar el gasto");
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createMutation.mutate();
    };

    return (
        <Dialog open={open} onOpenChange={(v) => {
            if (!v) resetForm();
            onOpenChange(v);
        }}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Nuevo Gasto</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Importe *</Label>
                            <Input
                                type="number"
                                min="0"
                                step="0.01"
                                required
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Fecha de registro *</Label>
                            <Input
                                type="datetime-local"
                                required
                                value={expenseDate}
                                onChange={(e) => setExpenseDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Categoría *</Label>
                            <Select value={categoryId} onValueChange={setCategoryId} required>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map((c) => (
                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Proveedor</Label>
                            <Input
                                type="text"
                                value={provider}
                                onChange={(e) => setProvider(e.target.value)}
                                placeholder="Nombre del proveedor"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Medio de pago *</Label>
                            <Select value={paymentMethod} onValueChange={setPaymentMethod} required>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar" />
                                </SelectTrigger>
                                <SelectContent>
                                    {paymentMethods.map((m) => (
                                        <SelectItem key={m.name} value={m.name}>{m.name}</SelectItem>
                                    ))}
                                    <SelectItem value="Efectivo">Efectivo</SelectItem>
                                    <SelectItem value="Transferencia">Transferencia</SelectItem>
                                    <SelectItem value="Tarjeta">Tarjeta</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Tipo de comprobante</Label>
                            <Select value={receiptType} onValueChange={setReceiptType}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Opcional" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Factura">Factura</SelectItem>
                                    <SelectItem value="Boleta">Boleta</SelectItem>
                                    <SelectItem value="Recibo">Recibo</SelectItem>
                                    <SelectItem value="Ticket">Ticket</SelectItem>
                                    <SelectItem value="Ninguno">Ninguno</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Descontar de Caja *</Label>
                        <Select value={registerId} onValueChange={setRegisterId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccionar caja" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="null">Ninguna (Gasto independiente)</SelectItem>
                                {registers.map((r) => (
                                    <SelectItem key={r.id} value={r.id}>
                                        Caja {format(new Date(r.opened_at), "dd/MM HH:mm")} (Abierta)
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground">Si seleccionas una caja abierta, este gasto se restará automáticamente del total físico esperado al momento del arqueo.</p>
                    </div>

                    <div className="space-y-2">
                        <Label>Comentario</Label>
                        <Textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Detalles adicionales del gasto..."
                            rows={2}
                        />
                    </div>

                    <DialogFooter className="pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={createMutation.isPending}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={createMutation.isPending} className="bg-orange-600 hover:bg-orange-700">
                            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Guardar Gasto
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
