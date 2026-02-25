import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface OpeningHoursSlot {
  open: string;
  close: string;
}

export interface DaySchedule {
  enabled: boolean;
  slots: OpeningHoursSlot[];
}

export interface OpeningHours {
  lunes: DaySchedule;
  martes: DaySchedule;
  miercoles: DaySchedule;
  jueves: DaySchedule;
  viernes: DaySchedule;
  sabado: DaySchedule;
  domingo: DaySchedule;
}

export interface RestaurantInfo {
  id: string;
  description: string | null;
  whatsapp: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  banner_url: string | null;
  enable_pickup: boolean;
  enable_delivery: boolean;
  opening_hours: OpeningHours | null;
  default_delivery_fee: number | null;
  default_tip_percentage: number | null;
  restaurant_name: string | null;
  nit: string | null;
  address: string | null;
  phone: string | null;
  tax_regime: string | null;
  pos_resolution: string | null;
  slogan: string | null;
  footer_message: string | null;
}

const DEFAULT_OPENING_HOURS: OpeningHours = {
  lunes: { enabled: true, slots: [{ open: "08:00", close: "22:00" }] },
  martes: { enabled: true, slots: [{ open: "08:00", close: "22:00" }] },
  miercoles: { enabled: true, slots: [{ open: "08:00", close: "22:00" }] },
  jueves: { enabled: true, slots: [{ open: "08:00", close: "22:00" }] },
  viernes: { enabled: true, slots: [{ open: "08:00", close: "22:00" }] },
  sabado: { enabled: true, slots: [{ open: "08:00", close: "22:00" }] },
  domingo: { enabled: false, slots: [{ open: "08:00", close: "22:00" }] },
};

export function useRestaurantInfo() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["restaurant_info"],
    queryFn: async (): Promise<RestaurantInfo> => {
      // Try to fetch existing record
      const { data, error } = await supabase
        .from("restaurant_info")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      // If no record exists, create one
      if (!data) {
        const { data: newData, error: insertError } = await supabase
          .from("restaurant_info")
          .insert({ name: "Mi Restaurante", description: "Mi Restaurante" } as any)
          .select()
          .single();

        if (insertError) throw insertError;

        return {
          ...newData,
          opening_hours: DEFAULT_OPENING_HOURS,
        } as RestaurantInfo;
      }

      return {
        ...data,
        opening_hours: data.opening_hours
          ? (data.opening_hours as unknown as OpeningHours)
          : DEFAULT_OPENING_HOURS,
      } as RestaurantInfo;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Omit<RestaurantInfo, "id">>) => {
      const id = query.data?.id;
      if (!id) throw new Error("No restaurant info found");

      const { error } = await supabase
        .from("restaurant_info")
        .update(updates as any)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant_info"] });
      toast({ title: "Guardado", description: "Configuración actualizada correctamente." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return {
    info: query.data,
    isLoading: query.isLoading,
    error: query.error,
    update: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    DEFAULT_OPENING_HOURS,
  };
}
