import { useState } from "react";
import { useTeam } from "@/hooks/useTeam";
import {
  useRolePermissions,
  useTogglePermission,
  PERMISSION_CATEGORIES,
  ALL_ROLES,
} from "@/hooks/useRolePermissions";
import { cn } from "@/lib/utils";
import { Check, X, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  subadmin: "Sub-Administrador",
  mesero: "Mesero",
  domiciliario: "Domiciliario",
  cajero: "Cajero",
  cocina: "Cocina",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-primary text-primary-foreground",
  subadmin: "bg-amber-500 text-white",
  mesero: "bg-amber-400 text-amber-950",
  domiciliario: "bg-teal-500 text-white",
  cajero: "bg-emerald-500 text-white",
  cocina: "bg-orange-500 text-white",
};

export default function RolePermissionsPage() {
  const [selectedRole, setSelectedRole] = useState<string>("mesero");
  const { data: team } = useTeam();
  const { data: permissions, isLoading } = useRolePermissions(selectedRole);
  const togglePermission = useTogglePermission();
  const { toast } = useToast();

  const userCountByRole = (role: string) =>
    team?.filter((m) => m.role === role).length ?? 0;

  const handleToggle = async (permission: string, currentValue: boolean) => {
    try {
      await togglePermission.mutateAsync({
        role: selectedRole,
        permission,
        enabled: !currentValue,
      });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-0 h-full min-h-[70vh]">
      {/* Left: Roles List */}
      <div className="lg:w-[400px] w-full border-r border-border bg-card">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Roles y Permisos
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configura los permisos para cada rol del sistema.
          </p>
        </div>

        <div className="divide-y divide-border">
          <div className="grid grid-cols-[1fr_80px] px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <span>Rol</span>
            <span className="text-center">Usuarios</span>
          </div>
          {ALL_ROLES.map((role) => {
            const isActive = selectedRole === role;
            const count = userCountByRole(role);
            return (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className={cn(
                  "w-full grid grid-cols-[1fr_80px] items-center px-4 py-3.5 text-left transition-colors",
                  isActive
                    ? "bg-amber-50 dark:bg-amber-950/30 border-l-4 border-primary"
                    : "hover:bg-muted/50 border-l-4 border-transparent"
                )}
              >
                <span className="font-semibold text-sm uppercase tracking-wide">
                  {ROLE_LABELS[role]}
                </span>
                <span className={cn(
                  "text-center text-sm font-medium",
                  count > 0 ? "text-primary" : "text-muted-foreground"
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Permissions Detail */}
      <div className="flex-1 bg-muted/30">
        {/* Role Header */}
        <div className={cn("px-6 py-4 flex items-center justify-between", ROLE_COLORS[selectedRole])}>
          <h3 className="text-lg font-bold uppercase tracking-wide">
            {ROLE_LABELS[selectedRole]}
          </h3>
        </div>

        {/* Permissions */}
        <div className="p-6 space-y-6">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-8">Cargando permisos...</div>
          ) : (
            Object.entries(PERMISSION_CATEGORIES).map(([category, perms]) => (
              <div key={category}>
                <h4 className="text-sm font-bold uppercase tracking-wider text-foreground mb-3 border-b border-border pb-2">
                  {category}
                </h4>
                <div className="space-y-1">
                  {perms.map((perm) => {
                    const enabled = permissions?.[perm.key] ?? false;
                    return (
                      <div
                        key={perm.key}
                        className={cn(
                          "flex items-center justify-between py-2.5 px-3 rounded-lg transition-colors",
                          enabled ? "bg-card" : "bg-transparent"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "h-5 w-5 rounded-full flex items-center justify-center text-xs",
                            enabled
                              ? "bg-emerald-500 text-white"
                              : "bg-muted text-muted-foreground"
                          )}>
                            {enabled ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          </div>
                          <span className={cn(
                            "text-sm",
                            enabled ? "font-medium text-foreground" : "text-muted-foreground"
                          )}>
                            {perm.label}
                          </span>
                        </div>
                        <Switch
                          checked={enabled}
                          onCheckedChange={() => handleToggle(perm.key, enabled)}
                          disabled={togglePermission.isPending}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
