import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const tabs = [
  { title: "Mostrador", url: "/restaurant/counter" },
  { title: "Mesas", url: "/restaurant/tables" },
  { title: "Domicilio", url: "/restaurant/delivery" },
  
];

export default function RestaurantLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen flex flex-col w-full bg-background">
      <header className="bg-card border-b border-border shadow-sm">
        <div className="flex items-center h-14 px-4 justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/products")} className="text-muted-foreground">
              <ArrowLeft className="h-4 w-4 mr-1" />
              <span className="text-xs">Admin</span>
            </Button>
            <span className="text-lg font-bold text-primary tracking-tight">🍽️ Restaurante</span>
            <nav className="flex items-center gap-0.5 ml-4">
              {tabs.map((tab) => {
                const isActive = location.pathname === tab.url;
                return (
                  <NavLink
                    key={tab.url}
                    to={tab.url}
                    className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? "text-primary-foreground bg-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                    activeClassName=""
                  >
                    {tab.title}
                  </NavLink>
                );
              })}
            </nav>
          </div>
          <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate("/auth", { replace: true }); }} className="text-muted-foreground hover:text-destructive">
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
