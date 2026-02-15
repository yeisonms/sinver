import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useRestaurantInfo, RestaurantInfo } from "@/hooks/useRestaurantInfo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { MessageCircle, Facebook, Instagram, Upload, ImageIcon, Loader2 } from "lucide-react";

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
  const [bannerUrl, setBannerUrl] = useState(info.banner_url || "");
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `banner-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("store-assets")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("store-assets")
        .getPublicUrl(path);

      setBannerUrl(urlData.publicUrl);
      toast({ title: "Imagen subida correctamente" });
    } catch (err: any) {
      toast({ title: "Error al subir imagen", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    update({
      description,
      whatsapp,
      facebook_url: facebookUrl,
      instagram_url: instagramUrl,
      banner_url: bannerUrl,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Información General</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Banner */}
        <div className="space-y-2">
          <Label>Imagen de Banner</Label>
          <div
            className="relative w-full h-48 rounded-lg border-2 border-dashed border-border bg-muted/40 flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            {bannerUrl ? (
              <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <ImageIcon className="h-10 w-10" />
                <span className="text-sm">Haz clic para subir un banner</span>
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          {bannerUrl && (
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="h-3 w-3 mr-1" /> Cambiar imagen
            </Button>
          )}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="desc">Descripción de la tienda</Label>
          <Textarea
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe tu restaurante para los clientes..."
            rows={3}
          />
        </div>

        {/* WhatsApp */}
        <div className="space-y-2">
          <Label htmlFor="wa">Número de WhatsApp</Label>
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

        {/* Facebook */}
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

        <Button onClick={handleSave} disabled={isUpdating} className="w-full sm:w-auto">
          {isUpdating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Guardar Cambios
        </Button>
      </CardContent>
    </Card>
  );
}
