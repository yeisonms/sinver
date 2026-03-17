import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { executePrintJob, type PrintComandaOptions } from "@/lib/printService";
import { toast } from "sonner";

/**
 * PrintListener runs stealthily in the background. It listens to Supabase Realtime
 * for new 'print_jobs' inserted by mobile phones (waiters) or the local computer.
 * When a job arrives, it executes the local ESC/POS translation and pushes to localhost:8081.
 */
export default function PrintListener() {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  useEffect(() => {
    // Si estamos en un celular, no queremos actuar como servidor de impresión
    if (isMobile) return;

    // 1. Subscribe to new insertions on the 'print_jobs' table
    const channel = supabase
      .channel("print-jobs-listener")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "print_jobs",
        },
        async (payload) => {
          console.log("🚨 ¡TRABAJO DE IMPRESIÓN DETECTADO!", payload.new);

          // 2. Reclamar el trabajo atómicamente para evitar impresiones duplicadas
          // Si hay 2 pestañas abiertas (o React Strict Mode), ambas intentarán actualizarlo,
          // pero la base de datos solo le dará permiso a una.
          const { data: claimData, error: claimError } = await supabase
            .from("print_jobs")
            .update({ status: "printed" })
            .eq("id", payload.new.id)
            .eq("status", "pending")
            .select("id")
            .maybeSingle();

          if (claimError || !claimData) {
            console.log("⚠️ Trabajo ya procesado por otra pestaña o dispositivo ignorando.");
            return; // Alguien más ya lo imprimió
          }

          try {
            const printOptions = payload.new.payload as PrintComandaOptions;
            
            // 3. Ejecutar la impresión física local
            await executePrintJob(printOptions);
            
          } catch (error) {
            console.error("Error procesando trabajo de impresión en segundo plano:", error);
            // Opcional: Podríamos revertir el status a 'pending' aquí si falla
            toast.error("Fallo de Impresión", {
              description: "No se pudo procesar un ticket entrante desde la nube."
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("📡 Escuchando trabajos de impresión remotos...");
        }
      });

    // 3. Cleanup the subscription if component unmounts
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return null; // This is a background daemon component, it renders nothing.
}
