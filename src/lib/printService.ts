import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PrintItem {
  product_id: string;
  product_name: string;
  quantity: number;
  notes: string | null;
  category_id: string | null;
}

interface PrinterTarget {
  printer_id: string;
  printer_name: string;
  ip_address: string;
  port: number;
  items: PrintItem[];
}

export interface PrintComandaOptions {
  items: PrintItem[];
  orderLabel: string;
  clientName?: string;
  waiterName?: string;
  orderType?: "mesa" | "domicilio" | "recoger";
  deliveryAddress?: string | null;
  deliveryPhone?: string | null;
  generalNotes?: string | null;
}

/**
 * Detect if running on Android mobile (likely has RawBT)
 */
function isMobileAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

/**
 * Build the ESC/POS binary payload for a single printer target
 */
function buildTicketPayload(
  target: PrinterTarget,
  opts: Omit<PrintComandaOptions, "items">
): Uint8Array {
  const encoder = new TextEncoder();
  const ESC = 0x1B;
  const GS = 0x1D;
  const parts: Uint8Array[] = [];

  // ESC @ — Initialize printer
  parts.push(new Uint8Array([ESC, 0x40]));

  // === HEADER: Order label in double size + bold ===
  parts.push(new Uint8Array([ESC, 0x45, 0x01])); // Bold ON
  parts.push(new Uint8Array([GS, 0x21, 0x11]));  // Double height+width
  parts.push(encoder.encode(`${opts.orderLabel}\n`));
  parts.push(new Uint8Array([GS, 0x21, 0x00]));  // Normal size
  parts.push(new Uint8Array([ESC, 0x45, 0x00])); // Bold OFF

  // === Client name ===
  const displayClient = opts.clientName || "Cliente Ocasional";
  parts.push(encoder.encode(`Cliente: ${displayClient}\n`));

  // === Delivery details (only for domicilio) ===
  if (opts.orderType === "domicilio") {
    if (opts.deliveryAddress) {
      parts.push(encoder.encode(`Dir: ${opts.deliveryAddress}\n`));
    }
    if (opts.deliveryPhone) {
      parts.push(encoder.encode(`Tel: ${opts.deliveryPhone}\n`));
    }
  }

  // === Waiter / Attendant ===
  if (opts.waiterName) {
    parts.push(encoder.encode(`Atendido por: ${opts.waiterName}\n`));
  }

  // === Printer destination ===
  parts.push(encoder.encode(`>> ${target.printer_name.toUpperCase()} <<\n`));

  // === Date/time ===
  parts.push(encoder.encode(`${new Date().toLocaleString("es-CO")}\n`));

  // Separator
  parts.push(encoder.encode("================================\n"));

  // === Items with notes ===
  for (const item of target.items) {
    parts.push(new Uint8Array([ESC, 0x45, 0x01])); // Bold ON
    parts.push(encoder.encode(`${item.quantity}x ${item.product_name}\n`));
    parts.push(new Uint8Array([ESC, 0x45, 0x00])); // Bold OFF
    if (item.notes) {
      parts.push(encoder.encode(`   (${item.notes.toUpperCase()})\n`));
    }
  }

  // Separator
  parts.push(encoder.encode("================================\n"));

  // === General notes ===
  if (opts.generalNotes) {
    parts.push(new Uint8Array([ESC, 0x45, 0x01])); // Bold ON
    parts.push(encoder.encode("NOTAS DEL PEDIDO:\n"));
    parts.push(new Uint8Array([ESC, 0x45, 0x00])); // Bold OFF
    parts.push(encoder.encode(`${opts.generalNotes}\n`));
    parts.push(encoder.encode("================================\n"));
  }

  // Extra line feeds so text doesn't get cut
  parts.push(encoder.encode("\n\n\n\n\n"));

  // GS V 0 — Full cut
  parts.push(new Uint8Array([GS, 0x56, 0x00]));

  // Merge all parts into one Uint8Array
  const totalLen = parts.reduce((s, p) => s + p.length, 0);
  const payload = new Uint8Array(totalLen);
  let offset = 0;
  for (const part of parts) {
    payload.set(part, offset);
    offset += part.length;
  }

  return payload;
}

/**
 * Send payload via RawBT (Android) — opens rawbt: URI with base64 data
 */
function sendViaRawBT(payload: Uint8Array): void {
  // Convert Uint8Array to base64
  let binary = "";
  for (let i = 0; i < payload.length; i++) {
    binary += String.fromCharCode(payload[i]);
  }
  const base64 = btoa(binary);
  const url = `rawbt:base64,${base64}`;
  window.location.href = url;
}

/**
 * Send payload via HTTP fetch (desktop / fallback)
 */
async function sendViaHTTP(payload: Uint8Array, ip: string, port: number): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  await fetch(`http://${ip}:${port}`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: new Blob([payload as any]),
    signal: controller.signal,
    mode: "no-cors",
  }).catch(() => {
    // no-cors opaque response — printer likely received it
  });

  clearTimeout(timeout);
}

/**
 * Groups order items by their assigned printers via category_printers,
 * then sends ESC/POS commands to each printer using RawBT on Android or HTTP otherwise.
 */
export async function printComanda(opts: PrintComandaOptions): Promise<void> {
  const { items } = opts;

  if (items.length === 0) {
    console.warn("⚠️ printComanda: No hay items para imprimir");
    return;
  }

  // 1. Get unique category IDs
  const categoryIds = [...new Set(items.map((i) => i.category_id).filter(Boolean))] as string[];
  if (categoryIds.length === 0) {
    console.warn("⚠️ printComanda: Ningún item tiene category_id");
    return;
  }

  // 2. Get category -> printer mappings
  const { data: mappings, error: mapErr } = await supabase
    .from("category_printers")
    .select("category_id, printer_id")
    .in("category_id", categoryIds);
  if (mapErr) { console.error("❌ Error consultando category_printers:", mapErr); return; }
  if (!mappings || mappings.length === 0) {
    console.warn("⚠️ printComanda: No hay impresoras asignadas a las categorías:", categoryIds);
    toast.warning("Sin impresoras asignadas", { description: "Las categorías de estos productos no tienen impresoras configuradas." });
    return;
  }

  // 3. Get printer details
  const printerIds = [...new Set(mappings.map((m) => m.printer_id))];
  const { data: printers, error: pErr } = await supabase
    .from("printers")
    .select("id, name, ip_address, port")
    .in("id", printerIds);
  if (pErr) { console.error("❌ Error consultando printers:", pErr); return; }
  if (!printers || printers.length === 0) {
    console.warn("⚠️ printComanda: No se encontraron impresoras para IDs:", printerIds);
    return;
  }
  console.log("🖨️ printComanda: Impresoras encontradas:", printers.map(p => `${p.name} (${p.ip_address}:${p.port})`));

  // Build a map: category_id -> printer_ids
  const catToPrinters = new Map<string, string[]>();
  for (const m of mappings) {
    const arr = catToPrinters.get(m.category_id) || [];
    arr.push(m.printer_id);
    catToPrinters.set(m.category_id, arr);
  }

  // Build printer groups
  const printerMap = new Map<string, PrinterTarget>();
  for (const p of printers) {
    if (!p.ip_address) continue;
    printerMap.set(p.id, {
      printer_id: p.id,
      printer_name: p.name,
      ip_address: p.ip_address,
      port: p.port || 9100,
      items: [],
    });
  }

  // Assign items to printers
  for (const item of items) {
    if (!item.category_id) continue;
    const pIds = catToPrinters.get(item.category_id) || [];
    for (const pid of pIds) {
      const target = printerMap.get(pid);
      if (target) {
        target.items.push(item);
      }
    }
  }

  // 4. Send to each printer
  const targets = [...printerMap.values()].filter((t) => t.items.length > 0);
  const useRawBT = isMobileAndroid();

  if (useRawBT) {
    // RawBT: send sequentially (each opens the app)
    for (const target of targets) {
      try {
        const payload = buildTicketPayload(target, opts);
        sendViaRawBT(payload);
        console.log(`✅ Comanda enviada via RawBT a ${target.printer_name}`);
        // Small delay between prints for RawBT to process
        await new Promise((r) => setTimeout(r, 500));
      } catch (err) {
        console.error(`❌ Error enviando via RawBT a ${target.printer_name}:`, err);
      }
    }
  } else {
    // HTTP: send in parallel
    const promises = targets.map(async (target) => {
      try {
        const payload = buildTicketPayload(target, opts);
        await sendViaHTTP(payload, target.ip_address, target.port);
        console.log(`✅ Comanda enviada a ${target.printer_name} (${target.ip_address})`);
      } catch (err) {
        console.error(`❌ Error enviando a ${target.printer_name}:`, err);
      }
    });
    await Promise.allSettled(promises);
  }
}
