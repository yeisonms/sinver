import { useState, useMemo } from "react";
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
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

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
  { title: "Configuración", url: "/admin/tables", icon: Settings, match: ["/admin/tables", "/admin/settings", "/admin/team", "/admin/printers", "/admin/payment-methods", "/admin/permissions"], allowedRoles: ["admin"] },
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
    { title: "M. Pago", url: "/admin/payment-methods" },
    { title: "Equipo", url: "/admin/team" },
    { title: "Permisos", url: "/admin/permissions" },
    { title: "Impresoras", url: "/admin/printers" },
  ],
  "/admin/tables": [
    { title: "General", url: "/admin/settings" },
    { title: "Salas y Mesas", url: "/admin/tables" },
    { title: "M. Pago", url: "/admin/payment-methods" },
    { title: "Equipo", url: "/admin/team" },
    { title: "Permisos", url: "/admin/permissions" },
    { title: "Impresoras", url: "/admin/printers" },
  ],
  "/admin/team": [
    { title: "General", url: "/admin/settings" },
    { title: "Salas y Mesas", url: "/admin/tables" },
    { title: "M. Pago", url: "/admin/payment-methods" },
    { title: "Equipo", url: "/admin/team" },
    { title: "Permisos", url: "/admin/permissions" },
    { title: "Impresoras", url: "/admin/printers" },
  ],
  "/admin/printers": [
    { title: "General", url: "/admin/settings" },
    { title: "Salas y Mesas", url: "/admin/tables" },
    { title: "M. Pago", url: "/admin/payment-methods" },
    { title: "Equipo", url: "/admin/team" },
    { title: "Permisos", url: "/admin/permissions" },
    { title: "Impresoras", url: "/admin/printers" },
  ],
  "/admin/payment-methods": [
    { title: "General", url: "/admin/settings" },
    { title: "Salas y Mesas", url: "/admin/tables" },
    { title: "M. Pago", url: "/admin/payment-methods" },
    { title: "Equipo", url: "/admin/team" },
    { title: "Permisos", url: "/admin/permissions" },
    { title: "Impresoras", url: "/admin/printers" },
  ],
  "/admin/permissions": [
    { title: "General", url: "/admin/settings" },
    { title: "Salas y Mesas", url: "/admin/tables" },
    { title: "M. Pago", url: "/admin/payment-methods" },
    { title: "Equipo", url: "/admin/team" },
    { title: "Permisos", url: "/admin/permissions" },
    { title: "Impresoras", url: "/admin/printers" },
  ],
};

const mobileNavItems = [
  { title: "Mostrador", url: "/restaurant/counter", icon: ShoppingCart, emoji: "🛍️" },
  { title: "Mesas", url: "/restaurant/tables", icon: UtensilsCrossed, emoji: "🍽️" },
  { title: "Domicilios", url: "/restaurant/delivery", icon: UtensilsCrossed, emoji: "🛵" },
  { title: "Productos", url: "/admin/products", icon: UtensilsCrossed, emoji: "📦", allowedRoles: ["admin"] as string[] },
  { title: "Ventas", url: "/admin/sales", icon: DollarSign, emoji: "💰", allowedRoles: ["admin"] as string[] },
  { title: "Tienda Online", url: "/admin/online-store", icon: Store, emoji: "🛒", allowedRoles: ["admin"] as string[] },
  { title: "Configuración", url: "/admin/tables", icon: Settings, emoji: "⚙️", allowedRoles: ["admin"] as string[] },
];

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, role } = useAuth();
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const currentPath = location.pathname;

  const visibleSections = useMemo(() =>
    allMainSections.filter(s => !s.allowedRoles || (role && s.allowedRoles.includes(role))),
    [role]
  );

  const visibleMobileItems = useMemo(() =>
    mobileNavItems.filter(item => !item.allowedRoles || (role && item.allowedRoles.includes(role))),
    [role]
  );

  const handleLogout = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };
  const currentTabs = subTabs[currentPath] || subTabs["/admin/products"] || [];

  const currentSection = allMainSections.find(s => s.match.some(m => currentPath.startsWith(m)));
  const pageTitle = currentSection?.title ?? "Admin";

  // Mobile layout: clean header + drawer only
  if (isMobile) {
    return (
      <div className="min-h-screen flex flex-col w-full bg-background">
        <header className="bg-navbar text-navbar-foreground h-14 flex items-center px-4 justify-between shrink-0 z-50">
          <div className="flex items-center gap-3">
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-navbar-foreground hover:bg-white/10">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0 flex flex-col">
                <div className="px-5 py-5 border-b border-border">
                  <p className="text-base font-bold">🍽️ Mi Restaurante</p>
                  <p className="text-sm text-muted-foreground mt-0.5">Panel de gestión</p>
                </div>
                <nav className="flex-1 py-2 overflow-y-auto">
                  {visibleMobileItems.map((item) => {
                    const isActive = location.pathname.startsWith(item.url);
                    return (
                      <button
                        key={item.url}
                        onClick={() => { navigate(item.url); setDrawerOpen(false); }}
                        className={`w-full flex items-center gap-3 px-5 py-3.5 text-left text-base transition-colors ${isActive
                          ? "bg-primary text-primary-foreground font-semibold rounded-lg mx-2 w-auto"
                          : "text-foreground hover:bg-muted"
                          }`}
                      >
                        <span className="text-lg">{item.emoji}</span>
                        {item.title}
                      </button>
                    );
                  })}
                </nav>
                <div className="border-t border-border px-5 py-4">
                  <div className="text-sm font-medium">{user?.email ?? ""}</div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-sm text-muted-foreground mt-2 hover:text-destructive"
                  >
                    <LogOut className="h-4 w-4" />
                    Salir
                  </button>
                </div>
              </SheetContent>
            </Sheet>
            <h1 className="text-lg font-bold">{pageTitle}</h1>
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="min-h-screen flex flex-col w-full bg-background/50">
      {/* Top Icon Bar */}
      <header className="bg-card/80 backdrop-blur-xl border-b border-white/20 shadow-premium sticky top-0 z-40">
        <div className="flex items-center h-16 px-6 gap-4 justify-between">
          <div className="flex items-center gap-6">
            <span className="text-xl font-bold text-primary tracking-tight">🍽️ Mi Restaurante</span>
            <nav className="flex items-center gap-1">
              {visibleSections.map((section) => {
                const isActive = section.match.some((m) => currentPath.startsWith(m));
                return (
                  <NavLink
                    key={section.url}
                    to={section.url}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-medium text-sm ${isActive
                      ? "text-primary bg-primary/10 shadow-inner"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                      }`}
                    activeClassName=""
                  >
                    <section.icon className={`h-4 w-4 ${isActive ? 'text-primary' : ''}`} />
                    <span>{section.title}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl h-10 px-4"
          >
            <LogOut className="h-4 w-4 mr-2" />
            <span className="text-sm font-medium">Cerrar Sesión</span>
          </Button>
        </div>
      </header>

      {/* Sub-tabs Bar */}
      {currentTabs.length > 0 && (
        <div className="bg-background/80 backdrop-blur-md border-b border-border/50 sticky top-16 z-30">
          <div className="flex items-center h-12 px-6 gap-2">
            {currentTabs.map((tab) => {
              const isActive = currentPath === tab.url;
              return (
                <NavLink
                  key={tab.url}
                  to={tab.url}
                  className={`px-4 h-full flex items-center text-sm font-medium transition-all relative ${isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
                  activeClassName=""
                >
                  {tab.title}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" />
                  )}
                </NavLink>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}