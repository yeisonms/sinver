import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldAlert } from "lucide-react";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [inactiveAlert, setInactiveAlert] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { session, isActive, role, profileLoading } = useAuth();

  // Show inactive alert if redirected from ProtectedRoute
  useEffect(() => {
    if (searchParams.get("inactive") === "true") {
      setInactiveAlert(true);
    }
  }, [searchParams]);

  // If already logged in and active, redirect
  useEffect(() => {
    if (session && !profileLoading && isActive === true) {
      const dest = role === "admin" ? "/admin/products" : "/restaurant/tables";
      navigate(dest, { replace: true });
    }
  }, [session, isActive, role, profileLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setInactiveAlert(false);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast({
          title: "Cuenta creada",
          description: "Tu cuenta ha sido creada y está pendiente de aprobación por el Administrador.",
        });
        // Sign out immediately after signup since is_active defaults to false
        await supabase.auth.signOut();
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        // Check is_active before allowing access
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_active, role")
          .eq("id", data.user.id)
          .single();

        if (!profile?.is_active) {
          await supabase.auth.signOut();
          setInactiveAlert(true);
          return;
        }

        const dest = profile.role === "admin" ? "/admin/products" : "/restaurant/tables";
        navigate(dest, { replace: true });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Ocurrió un error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      {/* Decorative gradient orb for premium feel */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent rounded-full blur-3xl pointer-events-none" />

      <Card className="w-full max-w-md border-0 shadow-premium bg-card/80 backdrop-blur-xl relative z-10 p-4 sm:p-6 transition-all duration-300">
        <CardHeader className="text-center space-y-3 pb-6">
          <div className="w-16 h-16 mx-auto bg-primary/10 rounded-2xl flex items-center justify-center mb-2 shadow-premium-soft">
            <span className="text-3xl">🍽️</span>
          </div>
          <CardTitle className="text-2xl font-semibold tracking-tight text-foreground">
            {isSignUp ? "Crear cuenta" : "Bienvenido de nuevo"}
          </CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            {isSignUp ? "Únete a SinverApp para empezar" : "Ingresa tus credenciales para continuar"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {inactiveAlert && (
            <Alert variant="destructive" className="mb-6 border-0 shadow-premium-soft rounded-xl">
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription className="ml-2">
                Cuenta pendiente de aprobación por el Administrador. Contacta a soporte.
              </AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-foreground/80">
                Correo Electrónico
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Ej. admin@restaurante.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 px-4 rounded-xl border-border/50 bg-background focus:ring-primary/20 transition-all shadow-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-foreground/80">
                Contraseña
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="h-12 px-4 rounded-xl border-border/50 bg-background focus:ring-primary/20 transition-all shadow-sm"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-12 mt-4 text-base font-medium rounded-xl shadow-premium-soft hover:shadow-premium transition-all duration-300"
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              {isSignUp ? "Registrarse" : "Iniciar Sesión"}
            </Button>
          </form>

          <div className="mt-8 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
            <span>{isSignUp ? "¿Ya tienes una cuenta?" : "¿Aún no tienes cuenta?"}</span>
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setInactiveAlert(false);
              }}
              className="text-primary font-medium hover:text-primary/80 transition-colors"
            >
              {isSignUp ? "Iniciar sesión aquí" : "Regístrate ahora"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
