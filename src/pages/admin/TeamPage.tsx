import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTeam, useCurrentUserRole, useUpdateTeamMember, TeamMember } from "@/hooks/useTeam";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, Users, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

const roleMeta: Record<string, { label: string; className: string }> = {
  admin: { label: "Admin", className: "bg-destructive text-destructive-foreground hover:bg-destructive/80" },
  mesero: { label: "Mesero", className: "bg-blue-600 text-white hover:bg-blue-600/80" },
  cajero: { label: "Cajero", className: "bg-green-600 text-white hover:bg-green-600/80" },
  cocina: { label: "Cocina", className: "bg-amber-600 text-white hover:bg-amber-600/80" },
};

function getInitials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

export default function TeamPage() {
  const navigate = useNavigate();
  const { data: role, isLoading: roleLoading } = useCurrentUserRole();
  const { data: members, isLoading } = useTeam();
  const updateMember = useUpdateTeamMember();

  useEffect(() => {
    if (!roleLoading && role !== "admin") {
      navigate("/admin/products", { replace: true });
    }
  }, [role, roleLoading, navigate]);

  if (roleLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (role !== "admin") return null;

  const handleRoleChange = (member: TeamMember, newRole: string) => {
    updateMember.mutate(
      { id: member.id, role: newRole },
      {
        onSuccess: () => toast.success(`Rol de ${member.full_name} actualizado a ${roleMeta[newRole]?.label}`),
        onError: () => toast.error("Error al actualizar el rol"),
      }
    );
  };

  const handleToggleActive = (member: TeamMember) => {
    updateMember.mutate(
      { id: member.id, is_active: !member.is_active },
      {
        onSuccess: () => toast.success(`${member.full_name} ${!member.is_active ? "activado" : "desactivado"}`),
        onError: () => toast.error("Error al cambiar el estado"),
      }
    );
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Equipo</h1>
          <p className="text-sm text-muted-foreground">Gestiona los roles y acceso de tu equipo</p>
        </div>
      </div>

      {members && members.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ShieldAlert className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>No hay usuarios registrados.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Usuario</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead className="text-center">Acceso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members?.map((member) => {
                const meta = roleMeta[member.role] || roleMeta.mesero;
                return (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                            {getInitials(member.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{member.full_name || "Sin nombre"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={member.role}
                        onValueChange={(val) => handleRoleChange(member, val)}
                      >
                        <SelectTrigger className="w-[130px] h-8">
                          <SelectValue>
                            <Badge className={meta.className}>{meta.label}</Badge>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(roleMeta).map(([key, m]) => (
                            <SelectItem key={key} value={key}>
                              <Badge className={m.className}>{m.label}</Badge>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={member.is_active}
                        onCheckedChange={() => handleToggleActive(member)}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
