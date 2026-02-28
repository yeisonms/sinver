import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTeam, useCurrentUserRole, useUpdateTeamMember, useCreateTeamMember, TeamMember } from "@/hooks/useTeam";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, ShieldAlert, Plus, Pencil, CheckCircle2, XCircle, Mail, Phone, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { UserFormDialog } from "@/components/admin/UserFormDialog";

const roleMeta: Record<string, { label: string; className: string }> = {
  admin: { label: "Admin", className: "bg-destructive text-destructive-foreground" },
  subadmin: { label: "Sub-Admin", className: "bg-orange-500 text-white" },
  mesero: { label: "Mesero", className: "bg-blue-600 text-white" },
  domiciliario: { label: "Domiciliario", className: "bg-teal-600 text-white" },
  cajero: { label: "Cajero", className: "bg-green-600 text-white" },
  cocina: { label: "Cocina", className: "bg-amber-600 text-white" },
};

function getInitials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "Nunca";
  return new Date(dateStr).toLocaleString("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function TeamPage() {
  const navigate = useNavigate();
  const { data: role, isLoading: roleLoading } = useCurrentUserRole();
  const { data: members, isLoading } = useTeam();
  const updateMember = useUpdateTeamMember();
  const createMember = useCreateTeamMember();

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");

  useEffect(() => {
    if (!roleLoading && role !== "admin" && role !== "subadmin") {
      navigate("/admin/products", { replace: true });
    }
  }, [role, roleLoading, navigate]);

  // Auto-select first user if none selected
  useEffect(() => {
    if (members && members.length > 0 && !selectedUserId) {
      setSelectedUserId(members[0].id);
    }
  }, [members, selectedUserId]);

  if (roleLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (role !== "admin" && role !== "subadmin") return null;

  const selectedUser = members?.find((m) => m.id === selectedUserId);

  const handleOpenCreate = () => {
    setDialogMode("create");
    setIsDialogOpen(true);
  };

  const handleOpenEdit = () => {
    if (!selectedUser) return;
    setDialogMode("edit");
    setIsDialogOpen(true);
  };

  const handleSaveUser = (formData: any) => {
    if (dialogMode === "create") {
      createMember.mutate(formData, {
        onSuccess: () => {
          toast.success("Usuario creado exitosamente");
          setIsDialogOpen(false);
        },
        onError: (err: any) => {
          toast.error("Error al crear usuario: " + err.message);
        }
      });
    } else if (dialogMode === "edit" && selectedUser) {
      updateMember.mutate(
        { id: selectedUser.id, full_name: formData.full_name, role: formData.role, is_active: formData.is_active },
        {
          onSuccess: () => {
            toast.success("Usuario actualizado");
            setIsDialogOpen(false);
          },
          onError: (err: any) => {
            toast.error("Error al actualizar: " + err.message);
          }
        }
      );
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Gestión de Usuarios</h1>
            <p className="text-sm text-muted-foreground">Administra los accesos al sistema</p>
          </div>
        </div>
        <Button onClick={handleOpenCreate} className="bg-black text-white hover:bg-black/90 transition-colors w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Usuario
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Maestros - Tabla Lateral Izquierda */}
        <div className="lg:col-span-2 border rounded-xl overflow-hidden bg-card shadow-sm">
          {members && members.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShieldAlert className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>No hay usuarios registrados o error al cargar.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Usuario (E-mail)</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Último Login</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members?.map((member) => {
                    const meta = roleMeta[member.role] || roleMeta.mesero;
                    const isActiveRow = selectedUserId === member.id;
                    return (
                      <TableRow
                        key={member.id}
                        onClick={() => setSelectedUserId(member.id)}
                        className={`cursor-pointer transition-colors ${isActiveRow ? 'bg-orange-50 hover:bg-orange-100/80 border-l-4 border-l-orange-500' : 'hover:bg-muted/50 border-l-4 border-l-transparent'}`}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8 hidden sm:block">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                                {getInitials(member.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className={`font-medium ${!member.is_active && 'text-muted-foreground line-through'}`}>{member.email || "Sin correo"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {member.full_name || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${meta.className} pointer-events-none`}>{meta.label}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(member.last_sign_in_at)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Detalles - Panel Lateral Derecho */}
        <div className="lg:col-span-1">
          {selectedUser ? (
            <Card className="sticky top-6 shadow-md border-0 bg-white overflow-hidden ring-1 ring-black/5">
              <div className="bg-orange-500 p-4 pb-12 relative flex items-start justify-between">
                <div>
                  <h3 className="text-white font-semibold text-lg truncate max-w-[200px]">{selectedUser.email}</h3>
                  <p className="text-orange-100 text-sm opacity-90">{roleMeta[selectedUser.role]?.label || selectedUser.role}</p>
                </div>
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8 rounded-full bg-white/20 text-white hover:bg-white/30 border-0"
                  onClick={handleOpenEdit}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>

              <div className="px-5 pb-6 pt-0 relative">
                {/* Avatar flotante */}
                <Avatar className="h-16 w-16 border-4 border-white absolute -top-8 bg-white shadow-sm">
                  <AvatarFallback className="bg-orange-100 text-orange-700 text-xl font-bold">
                    {getInitials(selectedUser.full_name)}
                  </AvatarFallback>
                </Avatar>

                <div className="mt-12 space-y-5">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm font-medium text-gray-500 flex items-center gap-2">
                      Nombre
                    </span>
                    <span className="text-sm font-semibold text-gray-900">{selectedUser.full_name || "-"}</span>
                  </div>

                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm font-medium text-gray-500 flex items-center gap-2">
                      <Mail className="h-4 w-4" /> E-mail
                    </span>
                    <span className="text-sm text-gray-900 truncate max-w-[150px]">{selectedUser.email}</span>
                  </div>

                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm font-medium text-gray-500 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" /> Estado
                    </span>
                    <span className="text-sm">
                      {selectedUser.is_active ?
                        <Badge variant="outline" className="border-green-500 text-green-600 bg-green-50">Activo</Badge> :
                        <Badge variant="outline" className="border-red-500 text-red-600 bg-red-50">Inactivo</Badge>
                      }
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm font-medium text-gray-500 flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" /> Último Login
                    </span>
                    <span className="text-sm text-gray-900">{formatDate(selectedUser.last_sign_in_at)}</span>
                  </div>

                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm font-medium text-gray-500 flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" /> Creado el
                    </span>
                    <span className="text-sm text-gray-900">{formatDate(selectedUser.created_at)}</span>
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <div className="h-full flex items-center justify-center p-6 border-2 border-dashed rounded-xl bg-card/50 text-muted-foreground">
              Selecciona un usuario para ver sus detalles
            </div>
          )}
        </div>
      </div>

      <UserFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        mode={dialogMode}
        initialData={selectedUser}
        onSave={handleSaveUser}
        isLoading={createMember.isPending || updateMember.isPending}
      />
    </div>
  );
}
