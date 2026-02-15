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
  const { session, isActive, profileLoading } = useAuth();

  // Show inactive alert if redirected from ProtectedRoute
  useEffect(() => {
    if (searchParams.get("inactive") === "true") {
      setInactiveAlert(true);
    }
  }, [searchParams]);

  // If already logged in and active, redirect
  useEffect(() => {
    if (session && !profileLoading && isActive === true) {
      navigate("/admin/products", { replace: true });
    }
  }, [session, isActive, profileLoading, navigate]);

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
          .select("is_active")
          .eq("id", data.user.id)
          .single();

        if (!profile?.is_active) {
          await supabase.auth.signOut();
          setInactiveAlert(true);
          return;
        }

        navigate("/admin/products", { replace: true });
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
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="text-4xl mb-2">🍽️</div>
          <CardTitle className="text-xl">Mi Restaurante</CardTitle>
          <CardDescription>
            {isSignUp ? "Crea tu cuenta" : "Inicia sesión para continuar"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {inactiveAlert && (
            <Alert variant="destructive" className="mb-4">
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription>
                Tu cuenta ha sido creada pero está pendiente de aprobación por el Administrador. Por favor contacta a soporte.
              </AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSignUp ? "Crear cuenta" : "Iniciar sesión"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            {isSignUp ? "¿Ya tienes cuenta?" : "¿No tienes cuenta?"}{" "}
            <button
              type="button"
              onClick={() => { setIsSignUp(!isSignUp); setInactiveAlert(false); }}
              className="text-primary underline-offset-4 hover:underline"
            >
              {isSignUp ? "Inicia sesión" : "Regístrate"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
