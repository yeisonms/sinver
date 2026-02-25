import { useState, useEffect } from "react";
import { useRestaurantInfo } from "@/hooks/useRestaurantInfo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save } from "lucide-react";

export default function GeneralSettingsPage() {
  const { info, isLoading, update, isUpdating } = useRestaurantInfo();

  const [form, setForm] = useState({
    restaurant_name: "",
    nit: "",
    address: "",
    phone: "",
    tax_regime: "",
    pos_resolution: "",
    slogan: "",
    footer_message: "",
  });

  useEffect(() => {
    if (info) {
      setForm({
        restaurant_name: (info as any).restaurant_name ?? "",
        nit: (info as any).nit ?? "",
        address: (info as any).address ?? "",
        phone: (info as any).phone ?? "",
        tax_regime: (info as any).tax_regime ?? "",
        pos_resolution: (info as any).pos_resolution ?? "",
        slogan: (info as any).slogan ?? "",
        footer_message: (info as any).footer_message ?? "",
      });
    }
  }, [info]);

  const handleSave = () => {
    update(form as any);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Configuración General</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Datos del Ticket / Factura</CardTitle>
          <CardDescription>
            Estos datos se imprimirán en los controles de mesa y pre-cuentas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="restaurant_name">Nombre del Restaurante</Label>
              <Input
                id="restaurant_name"
                value={form.restaurant_name}
                onChange={(e) => setForm((f) => ({ ...f, restaurant_name: e.target.value }))}
                placeholder="Mi Restaurante"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nit">NIT / RUT</Label>
              <Input
                id="nit"
                value={form.nit}
                onChange={(e) => setForm((f) => ({ ...f, nit: e.target.value }))}
                placeholder="900.123.456-7"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="address">Dirección</Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Calle 123 #45-67"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="601 234 5678"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tax_regime">Régimen Tributario</Label>
              <Input
                id="tax_regime"
                value={form.tax_regime}
                onChange={(e) => setForm((f) => ({ ...f, tax_regime: e.target.value }))}
                placeholder="Régimen Simplificado"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pos_resolution">Resolución POS</Label>
              <Input
                id="pos_resolution"
                value={form.pos_resolution}
                onChange={(e) => setForm((f) => ({ ...f, pos_resolution: e.target.value }))}
                placeholder="Res. DIAN No. ..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="slogan">Slogan</Label>
            <Input
              id="slogan"
              value={form.slogan}
              onChange={(e) => setForm((f) => ({ ...f, slogan: e.target.value }))}
              placeholder="¡Los mejores sabores de la ciudad!"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="footer_message">Mensaje de Pie de Ticket</Label>
            <Textarea
              id="footer_message"
              value={form.footer_message}
              onChange={(e) => setForm((f) => ({ ...f, footer_message: e.target.value }))}
              placeholder={"Gracias por su visita\nSíguenos en redes sociales"}
              rows={4}
            />
          </div>

          <Button onClick={handleSave} disabled={isUpdating} className="w-full sm:w-auto">
            {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
