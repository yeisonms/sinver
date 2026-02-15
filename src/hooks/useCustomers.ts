import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Customer } from "@/types/database";

export function useSearchCustomers(search: string) {
  return useQuery({
    queryKey: ["customers", "search", search],
    queryFn: async () => {
      if (!search || search.length < 1) return [];
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .or(`name.ilike.%${search}%,phone.ilike.%${search}%`)
        .limit(10);
      if (error) throw error;
      return data as Customer[];
    },
    enabled: search.length >= 1,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (customer: Omit<Customer, "id">) => {
      const { data, error } = await supabase
        .from("customers")
        .insert(customer)
        .select()
        .single();
      if (error) throw error;
      return data as Customer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}
