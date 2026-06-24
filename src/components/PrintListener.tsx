import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { executePrintJob, type PrintComandaOptions } from "@/lib/printService";
import { toast } from "sonner";

export const PRINT_MODE_KEY = "sinver_print_mode";

/**
 * PrintListener — Background daemon that picks up print jobs from Supabase Realtime.
 *
 * IMPORTANT: This component is only active if the user has explicitly enabled
 * "Print Mode" on this device (stored in localStorage as sinver_print_mode=enabled).
 *
 * This prevents multiple open tabs or remote devices from competing to claim
 * the same print job, which was causing silent failures.
 */
export default function PrintListener() {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const [isPrintModeEnabled, setIsPrintModeEnabled] = useState(
    () => localStorage.getItem(PRINT_MODE_KEY) === "enabled"
  );

  // Listen for localStorage changes from other components (e.g. PrintersPage toggle)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === PRINT_MODE_KEY) {
        setIsPrintModeEnabled(e.newValue === "enabled");
      }
    };
    // Also listen for same-tab changes via a custom event
    const handleCustom = (e: Event) => {
      const newValue = (e as CustomEvent<string>).detail;
      setIsPrintModeEnabled(newValue === "enabled");
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("sinver_print_mode_changed", handleCustom);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("sinver_print_mode_changed", handleCustom);
    };
  }, []);

  useEffect(() => {
    // Only desktop + explicitly enabled sessions act as a print server
    if (isMobile || !isPrintModeEnabled) {
      if (!isMobile && !isPrintModeEnabled) {
        console.log("🖨️ Modo Impresión desactivado en este dispositivo. Actívalo en Ajustes → Impresoras.");
      }
      return;
    }

    console.log("📡 Modo Impresión ACTIVO — escuchando trabajos de Supabase...");

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
              description: "No se pudo enviar el ticket a la impresora física.",
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("📡 [PrintListener] Suscrito a trabajos de impresión remotos.");
          toast.success("Modo Impresión Activo", {
            description: "Este equipo imprimirá las comandas de cocina.",
            duration: 3000,
          });
        } else if (status === "CHANNEL_ERROR") {
          console.error("❌ [PrintListener] Error en canal de Supabase Realtime.");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isMobile, isPrintModeEnabled]);

  // NUEVO LISTENER PARALELO: Escucha exclusivamente la tabla "cola_impresion"
  useEffect(() => {
    if (isMobile || !isPrintModeEnabled) return;

    const colaChannel = supabase
      .channel("cola-impresion-listener")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "cola_impresion",
        },
        async (payload) => {
          console.log("🚨 REIMPRESIÓN MANUAL DETECTADA!", payload.new);
          try {
            const orderId = payload.new.pedido_id;
            
            const { data: order, error: orderErr } = await supabase
              .from("orders")
              .select("*")
              .eq("id", orderId)
              .single();

            if (orderErr || !order) {
              console.error("❌ Elemento order no encontrado:", orderErr);
              return;
            }

            const { data: itemsData, error: itemsErr } = await supabase
              .from("order_items")
              .select(`
                *,
                products (
                  name,
                  category_id
                )
              `)
              .eq("order_id", orderId)
              .eq("status", "activo");

            if (itemsErr || !itemsData || itemsData.length === 0) {
              console.warn("⚠️ Sin items para reimprimir");
              return;
            }

            let waiterName: string | undefined;
            if (order.waiter_id) {
              const { data: profile } = await supabase
                .from("profiles")
                .select("full_name")
                .eq("id", order.waiter_id)
                .maybeSingle();
              waiterName = profile?.full_name || undefined;
            }

            const typeLabel = order.type === "domicilio" ? "DOMICILIO" : order.type === "recoger" ? "RECOGER" : "MESA";
            const orderLabel = `${typeLabel} #${order.order_number}`;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const printItems: any[] = itemsData.map((row: any) => ({
              product_id: row.product_id,
              product_name: row.products?.name || "Producto",
              quantity: row.quantity,
              notes: row.notes || null,
              category_id: row.products?.category_id || null,
              modifiers: row.modifiers || [],
            }));

            // Llamada directa a la función de red local
            await executePrintJob({
              items: printItems,
              orderLabel,
              clientName: order.client_name || undefined,
              waiterName,
              orderType: order.type as "mesa" | "domicilio" | "recoger",
              deliveryAddress: order.delivery_address,
              deliveryPhone: order.delivery_phone,
              generalNotes: order.general_notes,
              totalAmount: order.total_amount,
            });
            console.log("✅ Reimpresión manual enviada a servidor local");
          } catch (err) {
            console.error("Error en reimpresión paralela:", err);
            toast.error("Error de Reimpresión", {
              description: "Fallo al enviar a las impresoras de cocina.",
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("📡 [PrintListener] Suscrito a cola_impresion (reimpresiones manuales).");
        }
      });

    return () => {
      supabase.removeChannel(colaChannel);
    };
  }, [isMobile, isPrintModeEnabled]);

  return null;
}
