import { supabase } from "@/integrations/supabase/client";

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

/**
 * Groups order items by their assigned printers via category_printers,
 * then sends ESC/POS commands to each printer.
 */
export async function printComanda(
  items: PrintItem[],
  orderLabel: string // e.g. "MESA #5" or "DOMICILIO #49"
): Promise<void> {
  if (items.length === 0) return;

  // 1. Get unique category IDs
  const categoryIds = [...new Set(items.map((i) => i.category_id).filter(Boolean))] as string[];
  if (categoryIds.length === 0) return;

  // 2. Get category -> printer mappings
  const { data: mappings, error: mapErr } = await supabase
    .from("category_printers")
    .select("category_id, printer_id")
    .in("category_id", categoryIds);
  if (mapErr || !mappings || mappings.length === 0) return;

  // 3. Get printer details
  const printerIds = [...new Set(mappings.map((m) => m.printer_id))];
  const { data: printers, error: pErr } = await supabase
    .from("printers")
    .select("id, name, ip_address, port")
    .in("id", printerIds);
  if (pErr || !printers) return;

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
  const encoder = new TextEncoder();

  const promises = targets.map(async (target) => {
    try {
      const initCmd = new Uint8Array([0x1B, 0x40]); // Initialize
      const boldOn = new Uint8Array([0x1B, 0x45, 0x01]);
      const boldOff = new Uint8Array([0x1B, 0x45, 0x00]);
      const bigOn = new Uint8Array([0x1D, 0x21, 0x11]); // Double height+width
      const bigOff = new Uint8Array([0x1D, 0x21, 0x00]);
      const cutCmd = new Uint8Array([0x1D, 0x56, 0x00]); // Full cut

      let text = "";
      text += "\n";
      text += "================================\n";
      text += `  ${orderLabel}\n`;
      text += `  >> ${target.printer_name.toUpperCase()} <<\n`;
      text += "================================\n";
      text += `  ${new Date().toLocaleString("es-CO")}\n`;
      text += "--------------------------------\n";

      for (const item of target.items) {
        text += `  ${item.quantity}x ${item.product_name}\n`;
        if (item.notes) {
          text += `     * ${item.notes}\n`;
        }
      }

      text += "--------------------------------\n";
      text += "\n\n\n";

      const textBytes = encoder.encode(text);
      const payload = new Uint8Array([
        ...initCmd,
        ...boldOn,
        ...bigOn,
        ...encoder.encode(`  ${orderLabel}\n`),
        ...bigOff,
        ...boldOff,
        ...textBytes,
        ...cutCmd,
      ]);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      await fetch(`http://${target.ip_address}:${target.port}`, {
        method: "POST",
        body: payload,
        signal: controller.signal,
        mode: "no-cors",
      }).catch(() => {
        // no-cors requests may throw but still work
      });

      clearTimeout(timeout);
      console.log(`✅ Comanda enviada a ${target.printer_name} (${target.ip_address})`);
    } catch (err) {
      console.error(`❌ Error enviando a ${target.printer_name}:`, err);
    }
  });

  await Promise.allSettled(promises);
}
