import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useProductImageUpload() {
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File): Promise<string> => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("product-images")
        .upload(fileName, file, { cacheControl: "3600", upsert: false });
      if (error) throw error;

      const { data } = supabase.storage
        .from("product-images")
        .getPublicUrl(fileName);

      return data.publicUrl;
    } finally {
      setUploading(false);
    }
  };

  const remove = async (url: string) => {
    const parts = url.split("/product-images/");
    if (parts.length < 2) return;
    const path = parts[1];
    await supabase.storage.from("product-images").remove([path]);
  };

  return { upload, remove, uploading };
}
