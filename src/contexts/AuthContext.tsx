import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isActive: boolean | null;
  role: string | null;
  profileLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  isActive: null,
  role: null,
  profileLoading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isActive, setIsActive] = useState<boolean | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const isProfileLoaded = useRef(false);

  const checkProfile = async (userId: string) => {
    // Usamos useRef porque el callback de useEffect([]) forma un "stale closure"
    // y siempre veía `role` como null. Con useRef garantizamos que nunca
    // se vuelva a mostrar la pantalla de carga una vez descargado el perfil.
    if (!isProfileLoaded.current) {
      setProfileLoading(true);
    }
    const { data } = await supabase
      .from("profiles")
      .select("is_active, role")
      .eq("id", userId)
      .single();
    setIsActive(data?.is_active ?? false);
    setRole(data?.role ?? null);
    isProfileLoaded.current = true;
    setProfileLoading(false);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setLoading(false);
        if (session?.user) {
          setTimeout(() => checkProfile(session.user.id), 0);
        } else {
          setIsActive(null);
          setRole(null);
          setProfileLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session?.user) {
        checkProfile(session.user.id);
      } else {
        setProfileLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, isActive, role, profileLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
