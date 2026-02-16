import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Printer } from "@/types/database";

export function usePrinters() {
  return useQuery<Printer[]>({
    queryKey: ["printers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("printers")
        .select("id, name, ip_address, port")
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdatePrinter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ip_address, port }: { id: string; ip_address: string; port: number }) => {
      const { error } = await supabase.from("printers").update({ ip_address, port }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["printers"] }),
  });
}

export function useCategoryPrinters(categoryId: string | null) {
  return useQuery<string[]>({
    queryKey: ["category_printers", categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("category_printers")
        .select("printer_id")
        .eq("category_id", categoryId!);
      if (error) throw error;
      return data.map((r) => r.printer_id);
    },
  });
}
