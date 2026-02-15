import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TeamMember {
  id: string;
  full_name: string | null;
  role: "admin" | "mesero" | "cajero" | "cocina";
  is_active: boolean;
}

export function useTeam() {
  return useQuery<TeamMember[]>({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role, is_active")
        .order("full_name");
      if (error) throw error;
      return data as TeamMember[];
    },
  });
}

export function useCurrentUserRole() {
  return useQuery<string | null>({
    queryKey: ["current-user-role"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (error) return null;
      return data?.role ?? null;
    },
  });
}

export function useUpdateTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, role, is_active }: { id: string; role?: string; is_active?: boolean }) => {
      const updates: Record<string, unknown> = {};
      if (role !== undefined) updates.role = role;
      if (is_active !== undefined) updates.is_active = is_active;
      const { error } = await supabase.from("profiles").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
    },
  });
}
