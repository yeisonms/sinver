import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, CreditCard } from "lucide-react";
import { toast } from "sonner";
import type { PaymentMethod } from "@/types/database";

export default function PaymentMethodsPage() {
    const queryClient = useQueryClient();
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newMethodName, setNewMethodName] = useState("");

    const { data: methods = [], isLoading } = useQuery({
        queryKey: ["admin-payment-methods"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("payment_methods")
                .select("*")
                .order("created_at", { ascending: true });
            if (error) throw error;
            return data as PaymentMethod[];
        },
    });

    const toggleMutation = useMutation({
        mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
            const { error } = await supabase
                .from("payment_methods")
                .update({ is_active })
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-payment-methods"] });
            // We also invalidate the active ones that the checkout fetches
            queryClient.invalidateQueries({ queryKey: ["active-payment-methods"] });
            toast.success("Estado actualizado exitosamente");
        },
        onError: (error) => {
            toast.error("Error al actualizar: " + error.message);
        }
    });

    const createMutation = useMutation({
        mutationFn: async (name: string) => {
            const { error } = await supabase
                .from("payment_methods")
                .insert([{ name }]);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-payment-methods"] });
            queryClient.invalidateQueries({ queryKey: ["active-payment-methods"] });
            toast.success("Método de pago agregado exitosamente");
            setIsAddOpen(false);
            setNewMethodName("");
        },
        onError: (error: any) => {
            // Check for unique constraint violation
            if (error?.code === '23505') {
                toast.error("Ese método de pago ya existe");
            } else {
                toast.error("Error al agregar: " + error.message);
            }
        }
    });

    const handleToggle = (id: string, currentStatus: boolean) => {
        toggleMutation.mutate({ id, is_active: !currentStatus });
    };

    const handleAdd = () => {
        if (!newMethodName.trim()) {
            toast.warning("El nombre no puede estar vacío");
            return;
        }
        createMutation.mutate(newMethodName.trim());
    };

    if (isLoading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <CreditCard className="h-6 w-6 text-primary" />
                        Métodos de Pago
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Configura los medios de cobro habilitados para Cajas y Mesas.
                    </p>
                </div>
                <Button onClick={() => setIsAddOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Nuevo Método</span>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Métodos Registrados</CardTitle>
                    <CardDescription>
                        Activa o desactiva qué medios de pago aparecen en la pantalla de cobro.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {methods.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                            No hay métodos de pago registrados.
                        </div>
                    ) : (
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nombre</TableHead>
                                        <TableHead className="w-[150px] text-center">Estado</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {methods.map((method) => (
                                        <TableRow key={method.id}>
                                            <TableCell className="font-medium">
                                                {method.name}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Switch
                                                    checked={method.is_active}
                                                    onCheckedChange={() => handleToggle(method.id, method.is_active)}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Agregar Método de Pago</DialogTitle>
                        <DialogDescription>
                            Añade un nuevo tipo de pago. El nombre que escribas aquí es el que se guardará en los registros de venta.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nombre</Label>
                            <Input
                                id="name"
                                placeholder="Ej: Nequi, Daviplata, Efectivo USD..."
                                value={newMethodName}
                                onChange={(e) => setNewMethodName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleAdd();
                                }}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancelar</Button>
                        <Button onClick={handleAdd} disabled={createMutation.isPending}>
                            {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Guardar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
