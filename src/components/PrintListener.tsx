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
          console.log("🚨 ¡NUEVO TRABAJO DE IMPRESIÓN DESDE LA NUBE!", payload.new);
          
          try {
            const printOptions = payload.new.payload as PrintComandaOptions;
            
            // 2. Execute the physical local print job
            await executePrintJob(printOptions);
            
            // Optional: Mark the job as completed in DB so we don't process it again on reload
            await supabase
              .from("print_jobs")
              .update({ status: "printed" })
              .eq("id", payload.new.id);
              
          } catch (error) {
            console.error("Error procesando trabajo de impresión en segundo plano:", error);
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
