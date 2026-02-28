import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useRestaurantInfo, RestaurantInfo } from "@/hooks/useRestaurantInfo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { MessageCircle, Facebook, Instagram, Upload, ImageIcon, Loader2, DollarSign, Percent } from "lucide-react";

interface Props {
  info: RestaurantInfo;
}

export function GeneralTab({ info }: Props) {
  const { update, isUpdating } = useRestaurantInfo();
  const fileRef = useRef<HTMLInputElement>(null);

  const [description, setDescription] = useState(info.description || "");
  const [whatsapp, setWhatsapp] = useState(info.whatsapp || "");
  const [facebookUrl, setFacebookUrl] = useState(info.facebook_url || "");
  const [instagramUrl, setInstagramUrl] = useState(info.instagram_url || "");
  const [logoUrl, setLogoUrl] = useState(info.logo_url || "");
  const [email, setEmail] = useState(info.email || "");
  const [phone, setPhone] = useState(info.phone || "");
  const [address, setAddress] = useState(info.address || "");
  const [slogan, setSlogan] = useState(info.slogan || "");
  const [defaultDeliveryFee, setDefaultDeliveryFee] = useState(String(info.default_delivery_fee ?? ""));
  const [defaultTipPercentage, setDefaultTipPercentage] = useState(String(info.default_tip_percentage ?? ""));
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `logo-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("store-assets")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("store-assets")
        .getPublicUrl(path);

      setLogoUrl(urlData.publicUrl);
      toast({ title: "Logo subido correctamente" });
    } catch (err: any) {
      toast({ title: "Error al subir logo", description: err.message, variant: "destructive" });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = () => {
    update({
      description,
      whatsapp,
      facebook_url: facebookUrl,
      instagram_url: instagramUrl,
      logo_url: logoUrl,
      email,
      phone,
      address,
      slogan,
      default_delivery_fee: defaultDeliveryFee !== "" ? Number(defaultDeliveryFee) : null,
      default_tip_percentage: defaultTipPercentage !== "" ? Number(defaultTipPercentage) : null,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Información General</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Logo */}
        <div className="space-y-2">
          <Label>Logo del Restaurante</Label>
          <div
            className="relative w-32 h-32 rounded-full border-2 border-dashed border-border bg-muted/40 flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary/50 transition-colors mx-auto"
            onClick={() => logoRef.current?.click()}
          >
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-contain bg-white" />
            ) : (
              <div className="flex flex-col items-center gap-1 text-muted-foreground text-center px-2">
                <ImageIcon className="h-6 w-6" />
                <span className="text-[10px]">Subir Logo</span>
              </div>
            )}
            {uploadingLogo && (
              <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
          </div>
          <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleUploadLogo} />
          {logoUrl && (
            <div className="flex justify-center mt-2">
              <Button variant="outline" size="sm" onClick={() => logoRef.current?.click()}>
                <Upload className="h-3 w-3 mr-1" /> Cambiar logo
              </Button>
            </div>
          )}
        </div>

        <Separator />

        {/* Description & Slogan */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="desc">Nombre / Título de la tienda</Label>
            <Input
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: La Sinverguenceria Burguer"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slog">Slogan (Pie de página)</Label>
            <Input
              id="slog"
              value={slogan}
              onChange={(e) => setSlogan(e.target.value)}
              placeholder="Ej: Disfruta de la mejor comida al carbón..."
            />
          </div>
        </div>

        <Separator />

        {/* Contact info grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="wa">WhatsApp (Pedidos)</Label>
            <div className="relative">
              <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="wa"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="+57 300 1234567"
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ph">Teléfono Fijo / General</Label>
            <div className="relative">
              <Input
                id="ph"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(601) 765 4321"
                className="pl-3"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="em">Correo Electrónico</Label>
            <div className="relative">
              <Input
                id="em"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contacto@restaurante.com"
                className="pl-3"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="addr">Dirección Física</Label>
            <div className="relative">
              <Input
                id="addr"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Calle Falsa 123"
                className="pl-3"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Social */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="fb">URL de Facebook</Label>
            <div className="relative">
              <Facebook className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="fb"
                value={facebookUrl}
                onChange={(e) => setFacebookUrl(e.target.value)}
                placeholder="https://facebook.com/mi-restaurante"
                className="pl-10"
              />
            </div>
          </div>

          {/* Instagram */}
          <div className="space-y-2">
            <Label htmlFor="ig">URL de Instagram</Label>
            <div className="relative">
              <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="ig"
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                placeholder="https://instagram.com/mi-restaurante"
                className="pl-10"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Ajustes de Cobro */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Ajustes de Cobro</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Valores por defecto que se pre-llenan al crear pedidos. El cajero puede modificarlos en el momento.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="delivery-fee">Costo Base de Domicilio ($)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="delivery-fee"
                  type="number"
                  min={0}
                  value={defaultDeliveryFee}
                  onChange={(e) => setDefaultDeliveryFee(e.target.value)}
                  placeholder="1000"
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tip-pct">Propina Sugerida (%)</Label>
              <div className="relative">
                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="tip-pct"
                  type="number"
                  min={0}
                  max={100}
                  value={defaultTipPercentage}
                  onChange={(e) => setDefaultTipPercentage(e.target.value)}
                  placeholder="2"
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </div>

        <Button onClick={handleSave} disabled={isUpdating} className="w-full sm:w-auto">
          {isUpdating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Guardar Cambios
        </Button>
      </CardContent>
    </Card>
  );
}
