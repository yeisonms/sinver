import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useRestaurantInfo, RestaurantInfo } from "@/hooks/useRestaurantInfo";
import { Loader2, ShoppingBag, Truck } from "lucide-react";

interface Props {
  info: RestaurantInfo;
}

export function DeliveryMethodsTab({ info }: Props) {
  const { update, isUpdating } = useRestaurantInfo();

  const [enablePickup, setEnablePickup] = useState(info.enable_pickup);
  const [enableDelivery, setEnableDelivery] = useState(info.enable_delivery);

  const handleSave = () => {
    update({ enable_pickup: enablePickup, enable_delivery: enableDelivery });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Métodos de Entrega</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Pickup */}
        <div className="flex items-start gap-4 p-4 rounded-lg border border-border">
          <div className="p-2 rounded-md bg-accent">
            <ShoppingBag className="h-6 w-6 text-accent-foreground" />
          </div>
          <div className="flex-1 space-y-1">
            <Label className="text-base font-semibold">Habilitar para Recoger (Takeaway)</Label>
            <p className="text-sm text-muted-foreground">
              Los clientes podrán pedir por la web y buscar en el mostrador.
            </p>
          </div>
          <Switch checked={enablePickup} onCheckedChange={setEnablePickup} />
        </div>

        {/* Delivery */}
        <div className="flex items-start gap-4 p-4 rounded-lg border border-border">
          <div className="p-2 rounded-md bg-accent">
            <Truck className="h-6 w-6 text-accent-foreground" />
          </div>
          <div className="flex-1 space-y-1">
            <Label className="text-base font-semibold">Habilitar Domicilios (Delivery)</Label>
            <p className="text-sm text-muted-foreground">
              Los clientes podrán pedir envío a su dirección. Los pedidos llegarán al módulo de Domicilios.
            </p>
          </div>
          <Switch checked={enableDelivery} onCheckedChange={setEnableDelivery} />
        </div>

        <Button onClick={handleSave} disabled={isUpdating} className="w-full sm:w-auto">
          {isUpdating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Guardar Configuración
        </Button>
      </CardContent>
    </Card>
  );
}
