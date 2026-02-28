import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import type { TeamMember } from "@/hooks/useTeam";
import { toast } from "sonner";

interface UserFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: "create" | "edit";
    initialData?: TeamMember;
    onSave: (data: any) => void;
    isLoading: boolean;
}

export function UserFormDialog({ open, onOpenChange, mode, initialData, onSave, isLoading }: UserFormDialogProps) {
    const [formData, setFormData] = useState({
        email: "",
        password: "",
        full_name: "",
        role: "mesero",
        is_active: true,
    });

    useEffect(() => {
        if (open) {
            if (mode === "edit" && initialData) {
                setFormData({
                    email: initialData.email || "",
                    password: "", // never populate password on edit
                    full_name: initialData.full_name || "",
                    role: initialData.role || "mesero",
                    is_active: initialData.is_active,
                });
            } else {
                setFormData({
                    email: "",
                    password: "",
                    full_name: "",
                    role: "mesero",
                    is_active: true,
                });
            }
        }
    }, [open, mode, initialData]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (mode === "create" && !formData.password) {
            toast.error("La contraseña es requerida para nuevos usuarios");
            return;
        }
        onSave(formData);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{mode === "create" ? "Nuevo Usuario" : "Editar Usuario"}</DialogTitle>
                        <DialogDescription>
                            {mode === "create"
                                ? "Completa los datos para crear una nueva cuenta de acceso."
                                : "Modifica los permisos o datos de esta cuenta."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="full_name">Nombre completo</Label>
                            <Input
                                id="full_name"
                                required
                                value={formData.full_name}
                                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                placeholder="Ej. Juan Pérez"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Correo electrónico (Usuario)</Label>
                            <Input
                                id="email"
                                type="email"
                                required
                                disabled={mode === "edit"} // Prevent changing email on edit to keep things simple
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="usuario@tu-restaurante.com"
                            />
                        </div>
                        {mode === "create" && (
                            <div className="space-y-2">
                                <Label htmlFor="password">Contraseña temporal</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    required
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    placeholder="Mínimo 6 caracteres"
                                />
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="role">Rol</Label>
                                <Select
                                    value={formData.role}
                                    onValueChange={(v) => setFormData({ ...formData, role: v })}
                                >
                                    <SelectTrigger id="role">
                                        <SelectValue placeholder="Selecciona un rol" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="admin">Administrador</SelectItem>
                                        <SelectItem value="subadmin">Sub-Administrador</SelectItem>
                                        <SelectItem value="mesero">Mesero</SelectItem>
                                        <SelectItem value="domiciliario">Domiciliario</SelectItem>
                                        <SelectItem value="cajero">Cajero</SelectItem>
                                        <SelectItem value="cocina">Cocina</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2 flex flex-col justify-end pb-1">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="is_active">Activo</Label>
                                    <Switch
                                        id="is_active"
                                        checked={formData.is_active}
                                        onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {mode === "create" ? "Crear Usuario" : "Guardar Cambios"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
