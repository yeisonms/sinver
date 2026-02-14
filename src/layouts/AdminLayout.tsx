import { Outlet, useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import {
  Package,
  ShoppingCart,
  Settings,
  UtensilsCrossed,
} from "lucide-react";

const mainSections = [
  { title: "Productos", url: "/admin/products", icon: UtensilsCrossed },
  { title: "Ventas", url: "/admin/orders", icon: ShoppingCart },
  { title: "Configuración", url: "/admin/settings", icon: Settings },
];

const subTabs: Record<string, { title: string; url: string }[]> = {
  "/admin/products": [
    { title: "Productos", url: "/admin/products" },
    { title: "Cat. de Productos", url: "/admin/categories" },
  ],
  "/admin/categories": [
    { title: "Productos", url: "/admin/products" },
    { title: "Cat. de Productos", url: "/admin/categories" },
  ],
  "/admin/orders": [
    { title: "Pedidos", url: "/admin/orders" },
  ],
  "/admin/settings": [
    { title: "General", url: "/admin/settings" },
  ],
};

export default function AdminLayout() {
  const location = useLocation();
  const currentPath = location.pathname;
  const currentTabs = subTabs[currentPath] || subTabs["/admin/products"] || [];

  return (
    <div className="min-h-screen flex flex-col w-full">
      {/* Top Icon Bar */}
      <header className="bg-card border-b border-border">
        <div className="flex items-center h-14 px-4 gap-1">
          <span className="text-lg font-bold text-primary mr-6 tracking-tight">🍽️ Mi Restaurante</span>
          <nav className="flex items-center gap-1">
            {mainSections.map((section) => {
              const isActive = currentPath.startsWith(section.url) ||
                (section.url === "/admin/products" && currentPath === "/admin/categories");
              return (
                <NavLink
                  key={section.url}
                  to={section.url}
                  className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-muted/50 ${isActive ? "text-primary bg-primary/10" : ""}`}
                  activeClassName=""
                >
                  <section.icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium">{section.title}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Sub-tabs Bar */}
      {currentTabs.length > 0 && (
        <div className="bg-muted/40 border-b border-border">
          <div className="flex items-center h-10 px-4 gap-0">
            {currentTabs.map((tab) => {
              const isActive = currentPath === tab.url;
              return (
                <NavLink
                  key={tab.url}
                  to={tab.url}
                  className={`px-4 h-10 flex items-center text-sm font-medium transition-colors border-b-2 ${isActive ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
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
