import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { useRestaurantInfo } from "@/hooks/useRestaurantInfo";
import { GeneralTab } from "@/components/online-store/GeneralTab";
import { DeliveryMethodsTab } from "@/components/online-store/DeliveryMethodsTab";
import { ScheduleTab } from "@/components/online-store/ScheduleTab";

export default function OnlineStoreSettingsPage() {
  const { info, isLoading, error } = useRestaurantInfo();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !info) {
    return (
      <div className="p-8 text-center text-destructive">
        <p className="font-semibold">Error al cargar la configuración.</p>
        <p className="text-sm text-muted-foreground mt-1">
          Asegúrate de haber creado la tabla <code>restaurant_info</code> y de tener al menos un registro.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Configuración de Tienda Online</h1>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="general">Básica</TabsTrigger>
          <TabsTrigger value="delivery">Métodos de Entrega</TabsTrigger>
          <TabsTrigger value="schedule">Horarios</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <GeneralTab info={info} />
        </TabsContent>

        <TabsContent value="delivery" className="mt-6">
          <DeliveryMethodsTab info={info} />
        </TabsContent>

        <TabsContent value="schedule" className="mt-6">
          <ScheduleTab info={info} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
