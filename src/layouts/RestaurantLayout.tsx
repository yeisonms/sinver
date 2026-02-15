import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, ArrowLeft, Menu, Search, RefreshCw, UtensilsCrossed, Monitor, Truck, Settings, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

const tabs = [
  { title: "Mostrador", url: "/restaurant/counter", icon: Monitor },
  { title: "Mesas", url: "/restaurant/tables", icon: UtensilsCrossed },
  { title: "Domicilio", url: "/restaurant/delivery", icon: Truck },
];

export default function RestaurantLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const currentTab = tabs.find((t) => location.pathname.startsWith(t.url));
  const pageTitle = currentTab?.title ?? "Restaurante";

  if (isMobile) {
    return (
      <div className="min-h-screen flex flex-col w-full bg-background">
        {/* Mobile Navbar */}
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
                  <p className="text-sm text-muted-foreground">Restaurante</p>
                </div>
                <nav className="flex-1 py-2">
                  {tabs.map((tab) => {
                    const isActive = location.pathname.startsWith(tab.url);
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.url}
                        onClick={() => { navigate(tab.url); setDrawerOpen(false); }}
                        className={`w-full flex items-center gap-3 px-5 py-3.5 text-left text-base transition-colors ${
                          isActive
                            ? "bg-primary text-primary-foreground font-semibold rounded-lg mx-2 w-auto"
                            : "text-foreground hover:bg-muted"
                        }`}
                      >
                        <Icon className="h-5 w-5 shrink-0" />
                        {tab.title}
                      </button>
                    );
                  })}
                  <div className="border-t border-border my-2" />
                  <p className="px-5 py-2 text-xs text-muted-foreground font-semibold uppercase">Configuración</p>
                  <button
                    onClick={() => { navigate("/admin/products"); setDrawerOpen(false); }}
                    className="w-full flex items-center gap-3 px-5 py-3.5 text-left text-base text-foreground hover:bg-muted"
                  >
                    <Settings className="h-5 w-5 shrink-0" />
                    Admin
                  </button>
                </nav>
                <div className="border-t border-border px-5 py-4">
                  <div className="text-sm font-medium">{user?.email ?? ""}</div>
                  <button
                    onClick={async () => { await signOut(); navigate("/auth", { replace: true }); }}
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
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="text-navbar-foreground hover:bg-white/10" onClick={() => window.location.reload()}>
              <RefreshCw className="h-5 w-5" />
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    );
  }

  // Desktop layout (unchanged)
  return (
    <div className="min-h-screen flex flex-col w-full bg-background">
      <header className="bg-navbar text-navbar-foreground shadow-sm">
        <div className="flex items-center h-14 px-4 justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/products")} className="text-navbar-foreground/70 hover:bg-white/10">
              <ArrowLeft className="h-4 w-4 mr-1" />
              <span className="text-xs">Admin</span>
            </Button>
            <span className="text-lg font-bold tracking-tight">🍽️ Restaurante</span>
            <nav className="flex items-center gap-0.5 ml-4">
              {tabs.map((tab) => {
                const isActive = location.pathname.startsWith(tab.url);
                return (
                  <NavLink
                    key={tab.url}
                    to={tab.url}
                    className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? "text-primary-foreground bg-primary"
                        : "text-navbar-foreground/70 hover:text-navbar-foreground hover:bg-white/10"
                    }`}
                    activeClassName=""
                  >
                    {tab.title}
                  </NavLink>
                );
              })}
            </nav>
          </div>
          <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate("/auth", { replace: true }); }} className="text-navbar-foreground/70 hover:text-destructive hover:bg-white/10">
            <LogOut className="h-4 w-4 mr-1" />
            <span className="text-xs">Salir</span>
          </Button>
        </div>
      </header>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
