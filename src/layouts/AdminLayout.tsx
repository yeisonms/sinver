import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import {
  UtensilsCrossed,
  ShoppingCart,
  DollarSign,
  Store,
  Settings,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMemo } from "react";

interface NavSection {
  title: string;
  url: string;
  icon: typeof UtensilsCrossed;
  match: string[];
  allowedRoles?: string[];
}

const allMainSections: NavSection[] = [
  { title: "Productos", url: "/admin/products", icon: UtensilsCrossed, match: ["/admin/products", "/admin/categories", "/admin/modifiers"] },
  { title: "Ventas", url: "/admin/sales", icon: DollarSign, match: ["/admin/sales"], allowedRoles: ["admin"] },
  { title: "Restaurante", url: "/restaurant/counter", icon: ShoppingCart, match: ["/restaurant"] },
  { title: "Tienda Online", url: "/admin/online-store", icon: Store, match: ["/admin/online-store"], allowedRoles: ["admin"] },
  { title: "Configuración", url: "/admin/tables", icon: Settings, match: ["/admin/tables", "/admin/settings", "/admin/team", "/admin/printers"], allowedRoles: ["admin"] },
];

const subTabs: Record<string, { title: string; url: string }[]> = {
  "/admin/products": [
    { title: "Productos", url: "/admin/products" },
    { title: "Cat. de Productos", url: "/admin/categories" },
    { title: "Modificadores", url: "/admin/modifiers" },
  ],
  "/admin/categories": [
    { title: "Productos", url: "/admin/products" },
    { title: "Cat. de Productos", url: "/admin/categories" },
    { title: "Modificadores", url: "/admin/modifiers" },
  ],
  "/admin/modifiers": [
    { title: "Productos", url: "/admin/products" },
    { title: "Cat. de Productos", url: "/admin/categories" },
    { title: "Modificadores", url: "/admin/modifiers" },
  ],
  "/admin/orders": [
    { title: "Pedidos", url: "/admin/orders" },
  ],
  "/admin/sales": [
    { title: "Ventas", url: "/admin/sales" },
  ],
  "/admin/online-store": [
    { title: "Configuración", url: "/admin/online-store" },
  ],
  "/admin/settings": [
    { title: "General", url: "/admin/settings" },
    { title: "Salas y Mesas", url: "/admin/tables" },
    { title: "Equipo", url: "/admin/team" },
    { title: "Impresoras", url: "/admin/printers" },
  ],
  "/admin/tables": [
    { title: "General", url: "/admin/settings" },
    { title: "Salas y Mesas", url: "/admin/tables" },
    { title: "Equipo", url: "/admin/team" },
    { title: "Impresoras", url: "/admin/printers" },
  ],
  "/admin/team": [
    { title: "General", url: "/admin/settings" },
    { title: "Salas y Mesas", url: "/admin/tables" },
    { title: "Equipo", url: "/admin/team" },
    { title: "Impresoras", url: "/admin/printers" },
  ],
  "/admin/printers": [
    { title: "General", url: "/admin/settings" },
    { title: "Salas y Mesas", url: "/admin/tables" },
    { title: "Equipo", url: "/admin/team" },
    { title: "Impresoras", url: "/admin/printers" },
  ],
};

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, role } = useAuth();
  const currentPath = location.pathname;

  const visibleSections = useMemo(() =>
    allMainSections.filter(s => !s.allowedRoles || (role && s.allowedRoles.includes(role))),
    [role]
  );

  const handleLogout = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };
  const currentTabs = subTabs[currentPath] || subTabs["/admin/products"] || [];

  return (
    <div className="min-h-screen flex flex-col w-full bg-background">
      {/* Top Icon Bar */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="flex items-center h-14 px-4 gap-1 justify-between">
          <div className="flex items-center gap-1">
            <span className="text-lg font-bold text-primary mr-6 tracking-tight">🍽️ Mi Restaurante</span>
            <nav className="flex items-center gap-0.5">
              {visibleSections.map((section) => {
                const isActive = section.match.some((m) => currentPath.startsWith(m));
                return (
                  <NavLink
                    key={section.url}
                    to={section.url}
                    className={`flex flex-col items-center gap-0.5 px-5 py-1.5 rounded-md transition-colors ${
                      isActive
                        ? "text-primary-foreground bg-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                    activeClassName=""
                  >
                    <section.icon className="h-5 w-5" />
                    <span className="text-[10px] font-medium">{section.title}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-muted-foreground hover:text-destructive"
          >
            <LogOut className="h-4 w-4 mr-1" />
            <span className="text-xs">Salir</span>
          </Button>
        </div>
      </header>

      {/* Sub-tabs Bar */}
      {currentTabs.length > 0 && (
        <div className="bg-muted/60 border-b border-border">
          <div className="flex items-center h-10 px-4 gap-0">
            {currentTabs.map((tab) => {
              const isActive = currentPath === tab.url;
              return (
                <NavLink
                  key={tab.url}
                  to={tab.url}
                  className={`px-5 h-10 flex items-center text-sm font-medium transition-colors border-b-2 ${
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                  activeClassName=""
                >
                  {tab.title}
                </NavLink>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}