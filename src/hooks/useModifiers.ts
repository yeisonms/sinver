import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ModifierGroup, ModifierOption } from "@/types/database";

export function useModifierGroups() {
  return useQuery<ModifierGroup[]>({
    queryKey: ["modifier_groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modifier_groups")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateModifierGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (group: Omit<ModifierGroup, "id">) => {
      const { data, error } = await supabase.from("modifier_groups").insert(group).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["modifier_groups"] }),
  });
}

export function useUpdateModifierGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ModifierGroup> & { id: string }) => {
      const { data, error } = await supabase.from("modifier_groups").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["modifier_groups"] }),
  });
}

export function useDeleteModifierGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("modifier_groups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["modifier_groups"] }),
  });
}

// Modifier Options
export function useModifierOptions(groupId: string | null) {
  return useQuery<ModifierOption[]>({
    queryKey: ["modifier_options", groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modifier_options")
        .select("*")
        .eq("group_id", groupId!)
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateModifierOption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (option: Omit<ModifierOption, "id">) => {
      const { data, error } = await supabase.from("modifier_options").insert(option).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["modifier_options", vars.group_id] });
    },
  });
}

export function useDeleteModifierOption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, groupId }: { id: string; groupId: string }) => {
      const { error } = await supabase.from("modifier_options").delete().eq("id", id);
      if (error) throw error;
      return groupId;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["modifier_options", vars.groupId] });
    },
  });
}

// Associated products (read-only)
export function useAssociatedProducts(groupId: string | null) {
  return useQuery<{ id: string; name: string }[]>({
    queryKey: ["product_modifiers", groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_modifiers")
        .select("product_id, products(name)")
        .eq("group_id", groupId!);
      if (error) throw error;
      return (data || []).map((r: any) => ({ id: r.product_id, name: r.products?.name || "Sin nombre" }));
    },
  });
}

// Fetch modifier groups + options for a specific product
export function useProductModifierGroups(productId: string | null) {
  return useQuery<(ModifierGroup & { options: ModifierOption[] })[]>({
    queryKey: ["product_modifier_groups", productId],
    enabled: !!productId,
    queryFn: async () => {
      // Get group IDs linked to this product
      const { data: links, error: linkErr } = await supabase
        .from("product_modifiers")
        .select("group_id")
        .eq("product_id", productId!);
      if (linkErr) throw linkErr;
      if (!links || links.length === 0) return [];

      const groupIds = links.map((l) => l.group_id);

      // Get groups
      const { data: groups, error: groupErr } = await supabase
        .from("modifier_groups")
        .select("*")
        .in("id", groupIds)
        .order("name");
      if (groupErr) throw groupErr;

      // Get all options for these groups
      const { data: options, error: optErr } = await supabase
        .from("modifier_options")
        .select("*")
        .in("group_id", groupIds)
        .order("name");
      if (optErr) throw optErr;

      return (groups || []).map((g) => ({
        ...g,
        options: (options || []).filter((o) => o.group_id === g.id),
      }));
    },
  });
}
