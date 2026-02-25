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
 * Send payload via local node proxy (desktop / fallback)
 * This avoids the browser appending raw HTTP headers to the print stream.
 */
async function sendViaHTTP(payload: Uint8Array, ip: string, port: number): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(`http://localhost:8081/print`, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Printer-IP": ip,
        "X-Printer-Port": port.toString(),
      },
      body: new Blob([payload as any]),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Error en proxy local: ${res.statusText}`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.error("❌ El proxy local no respondió a tiempo.");
      toast.error("Error de impresión", {
        description: "El proxy local (print-proxy) tardó mucho en responder. Verifica que esté abierto.",
      });
    } else {
      console.error("❌ Error enviando ticket al proxy:", err);
      toast.error("Error de conexión con la caja", {
        description: "Asegúrate de tener la consola negra 'start.bat' de Sinver Print Proxy abierta.",
      });
    }
    throw err; // Re-throw to handle it in printing loop
  } finally {
    clearTimeout(timeout);
  }
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

/**
 * Convenience helper to pull an existing order and its active items from the database
 * and send them to printComanda(). Useful for printing web orders upon acceptance.
 */
export async function reprintOrder(orderId: string): Promise<void> {
  try {
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
      console.warn("⚠️ Sin items para imprimir");
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
    const printItems: PrintItem[] = itemsData.map((row: any) => ({
      product_id: row.product_id,
      product_name: row.products?.name || "Producto",
      quantity: row.quantity,
      notes: row.notes || null,
      category_id: row.products?.category_id || null,
    }));

    await printComanda({
      items: printItems,
      orderLabel,
      clientName: order.client_name || undefined,
      waiterName,
      orderType: order.type as "mesa" | "domicilio" | "recoger",
      deliveryAddress: order.delivery_address,
      deliveryPhone: order.delivery_phone,
      generalNotes: order.general_notes,
    });
  } catch (err) {
    console.error("Error en reprintOrder:", err);
  }
}

export interface PrintReceiptOptions {
  restaurantName: string;
  nit: string;
  address: string;
  phone: string;
  taxRegime: string;
  posResolution: string;
  slogan: string;
  footerMessage: string;
  tableName: string;
  orderNumber: number;
  waiterName: string;
  items: { name: string; quantity: number; unit_price: number }[];
  tipPercentage: number;
}

function buildReceiptPayload(opts: PrintReceiptOptions): Uint8Array {
  const encoder = new TextEncoder();
  const ESC = 0x1B;
  const GS = 0x1D;
  const parts: Uint8Array[] = [];

  parts.push(new Uint8Array([ESC, 0x40])); // Init

  // Center alignment
  parts.push(new Uint8Array([ESC, 0x61, 0x01]));

  // Header
  parts.push(new Uint8Array([ESC, 0x45, 0x01])); // Bold
  parts.push(new Uint8Array([GS, 0x21, 0x11]));  // Double size
  parts.push(encoder.encode(`${opts.restaurantName}\n`));
  parts.push(new Uint8Array([GS, 0x21, 0x00]));  // Normal size
  parts.push(new Uint8Array([ESC, 0x45, 0x00])); // Bold off

  if (opts.nit) parts.push(encoder.encode(`NIT: ${opts.nit}\n`));
  if (opts.taxRegime) parts.push(encoder.encode(`${opts.taxRegime}\n`));
  if (opts.address) parts.push(encoder.encode(`${opts.address}\n`));
  if (opts.phone) parts.push(encoder.encode(`Tel: ${opts.phone}\n`));
  if (opts.posResolution) parts.push(encoder.encode(`Res: ${opts.posResolution}\n`));

  parts.push(encoder.encode("\n"));
  parts.push(new Uint8Array([ESC, 0x45, 0x01])); // Bold
  parts.push(encoder.encode(`*** PRE-CUENTA ***\n`));
  parts.push(new Uint8Array([ESC, 0x45, 0x00])); // Bold off
  parts.push(encoder.encode("\n"));

  // Left alignment for details
  parts.push(new Uint8Array([ESC, 0x61, 0x00]));

  parts.push(encoder.encode(`MESA: ${opts.tableName}     ORDEN: #${opts.orderNumber}\n`));
  parts.push(encoder.encode(`FECHA: ${new Date().toLocaleString("es-CO")}\n`));
  parts.push(encoder.encode(`ATENDIÓ: ${opts.waiterName}\n`));
  parts.push(encoder.encode("--------------------------------\n"));

  parts.push(encoder.encode("CANT | DESCRIPCION    | SUBTOTAL\n"));
  parts.push(encoder.encode("--------------------------------\n"));

  let subtotal = 0;
  for (const item of opts.items) {
    const itemSub = item.quantity * item.unit_price;
    subtotal += itemSub;
    const qtyStr = item.quantity.toString().padEnd(4);
    let nameStr = item.name.substring(0, 14).padEnd(14);
    const subStr = itemSub.toLocaleString("es-CO").padStart(10);

    parts.push(encoder.encode(`${qtyStr} | ${nameStr} | ${subStr}\n`));

    // If name is longer than 14, print the rest on next line
    if (item.name.length > 14) {
      const rest = item.name.substring(14, 28);
      parts.push(encoder.encode(`     | ${rest}\n`));
    }
  }

  parts.push(encoder.encode("--------------------------------\n"));

  // Right alignment for totals
  parts.push(new Uint8Array([ESC, 0x61, 0x02]));
  parts.push(encoder.encode(`SUBTOTAL: $ ${subtotal.toLocaleString("es-CO")}\n`));

  let tip = 0;
  if (opts.tipPercentage > 0) {
    tip = Math.round(subtotal * (opts.tipPercentage / 100));
    parts.push(encoder.encode(`PROPINA (${opts.tipPercentage}%): $ ${tip.toLocaleString("es-CO")}\n`));
  }

  const total = subtotal + tip;
  parts.push(new Uint8Array([ESC, 0x45, 0x01])); // Bold
  parts.push(new Uint8Array([GS, 0x21, 0x01]));  // Double height
  parts.push(encoder.encode(`TOTAL: $ ${total.toLocaleString("es-CO")}\n`));
  parts.push(new Uint8Array([GS, 0x21, 0x00]));
  parts.push(new Uint8Array([ESC, 0x45, 0x00]));

  parts.push(encoder.encode("\n"));

  // Center alignment for footer
  parts.push(new Uint8Array([ESC, 0x61, 0x01]));
  if (opts.slogan) parts.push(encoder.encode(`${opts.slogan}\n`));
  if (opts.footerMessage) {
    parts.push(encoder.encode("\n"));
    const msgLines = opts.footerMessage.split('\n');
    for (const line of msgLines) {
      parts.push(encoder.encode(`${line}\n`));
    }
  }

  parts.push(encoder.encode("\nDOCUMENTO NO VALIDO COMO FACTURA\n"));

  parts.push(encoder.encode("\n\n\n\n\n")); // Feed
  parts.push(new Uint8Array([GS, 0x56, 0x00])); // Cut

  const totalLen = parts.reduce((s, p) => s + p.length, 0);
  const payload = new Uint8Array(totalLen);
  let offset = 0;
  for (const p of parts) {
    payload.set(p, offset);
    offset += p.length;
  }
  return payload;
}

export async function printControlReceipt(opts: PrintReceiptOptions): Promise<void> {
  const { data: printers, error } = await supabase
    .from("printers")
    .select("id, name, ip_address, port");

  if (error || !printers || printers.length === 0) {
    console.warn("⚠️ No printers found to print the receipt.");
    toast.error("No hay impresoras configuradas.");
    return;
  }

  // Try to find a printer named "caja" or use the first available IP printer
  let targetPrinter = printers.find(p => p.name.toLowerCase().includes("caja") && p.ip_address);
  if (!targetPrinter) {
    targetPrinter = printers.find(p => p.ip_address);
  }

  if (!targetPrinter) {
    if (isMobileAndroid()) {
      // In RawBT any printer can be used without explicitly knowing the IP
      targetPrinter = printers[0];
    } else {
      toast.error("Ninguna impresora tiene dirección IP configurada.");
      return;
    }
  }

  const payload = buildReceiptPayload(opts);

  if (isMobileAndroid()) {
    try {
      sendViaRawBT(payload);
      console.log(`✅ Pre-cuenta enviada via RawBT`);
    } catch (err) {
      console.error(`❌ Error enviando via RawBT:`, err);
    }
  } else {
    try {
      await sendViaHTTP(payload, targetPrinter.ip_address!, targetPrinter.port || 9100);
      console.log(`✅ Pre-cuenta enviada a ${targetPrinter.name}`);
      toast.success("Imprimiendo cuenta...");
    } catch (err) {
      console.error(`❌ Error enviando a ${targetPrinter.name}:`, err);
    }
  }
}

