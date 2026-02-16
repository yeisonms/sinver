import { useState } from "react";
import { usePrinters, useUpdatePrinter } from "@/hooks/usePrinters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Printer, Wifi, Loader2, CheckCircle2, XCircle, Save } from "lucide-react";

type TestStatus = "idle" | "testing" | "success" | "error";

export default function PrintersPage() {
  const { data: printers = [], isLoading } = usePrinters();
  const updatePrinter = useUpdatePrinter();
  const [edits, setEdits] = useState<Record<string, { ip: string; port: string }>>({});
  const [testStatus, setTestStatus] = useState<Record<string, TestStatus>>({});

  const getEdit = (id: string, ip: string | null, port: number | null) => {
    if (edits[id]) return edits[id];
    return { ip: ip || "", port: String(port || 9100) };
  };

  const setEdit = (id: string, field: "ip" | "port", value: string) => {
    setEdits((prev) => ({
      ...prev,
      [id]: { ...getEdit(id, null, null), ...prev[id], [field]: value },
    }));
    setTestStatus((prev) => ({ ...prev, [id]: "idle" }));
  };

  const handleSave = async (id: string) => {
    const edit = edits[id];
    if (!edit?.ip?.trim()) {
      toast.error("Ingresa una IP válida");
      return;
    }
    try {
      await updatePrinter.mutateAsync({ id, ip_address: edit.ip.trim(), port: parseInt(edit.port) || 9100 });
      toast.success("Impresora actualizada");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleTest = async (id: string, ip: string, port: string) => {
    if (!ip.trim()) { toast.error("Ingresa una IP"); return; }
    setTestStatus((prev) => ({ ...prev, [id]: "testing" }));

    const isHttps = window.location.protocol === "https:";

    if (isHttps) {
      // HTTPS blocks mixed content requests to local HTTP IPs
      setTestStatus((prev) => ({ ...prev, [id]: "error" }));
      toast.error("Conexión directa bloqueada por HTTPS", {
        description: "El navegador bloquea peticiones HTTP desde HTTPS. Usa 'window.print()' o abre la app desde la red local (http://).",
        duration: 8000,
      });
      return;
    }

    try {
      const encoder = new TextEncoder();
      const initCmd = new Uint8Array([0x1B, 0x40]);
      const text = encoder.encode(
        "\n================================\n" +
        "   PRUEBA DE CONEXION Wi-Fi\n" +
        "================================\n\n" +
        "  Sistema Fudo Restaurante\n\n" +
        `  IP: ${ip}:${port}\n` +
        `  Fecha: ${new Date().toLocaleString("es-CO")}\n\n` +
        "  Conexion EXITOSA!\n\n" +
        "================================\n\n\n\n"
      );
      const cutCmd = new Uint8Array([0x1D, 0x56, 0x00]);
      const payload = new Uint8Array([...initCmd, ...text, ...cutCmd]);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      await fetch(`http://${ip}:${parseInt(port) || 9100}`, {
        method: "POST", body: payload, signal: controller.signal, mode: "no-cors",
      });
      clearTimeout(timeout);

      setTestStatus((prev) => ({ ...prev, [id]: "success" }));
      toast.success(`Datos enviados a ${ip}`, {
        description: "Verifica físicamente si la impresora imprimió el ticket de prueba.",
      });
    } catch {
      setTestStatus((prev) => ({ ...prev, [id]: "error" }));
      toast.error("Error de conexión", {
        description: "Verifica que la IP y el puerto sean correctos y que la impresora esté encendida.",
      });
    }
  };

  const statusIcon = (s: TestStatus) => {
    if (s === "testing") return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    if (s === "success") return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (s === "error") return <XCircle className="h-4 w-4 text-destructive" />;
    return <Wifi className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Impresoras</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configura la IP de cada impresora térmica. Las categorías asignadas determinan qué items se imprimen en cada una.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : printers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Printer className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No hay impresoras registradas en la base de datos.</p>
            <p className="text-xs text-muted-foreground mt-1">Agrega impresoras desde tu panel de Supabase.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {printers.map((printer) => {
            const edit = getEdit(printer.id, printer.ip_address, printer.port);
            const status = testStatus[printer.id] || "idle";
            const isDirty = edits[printer.id] !== undefined;

            return (
              <Card key={printer.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Printer className="h-4 w-4" />
                    {printer.name}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Las categorías asignadas a esta impresora se envían automáticamente al confirmar pedidos.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-end gap-3">
                    <div className="flex-1 space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Dirección IP</label>
                      <Input
                        placeholder="192.168.1.200"
                        value={edit.ip}
                        onChange={(e) => setEdit(printer.id, "ip", e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="w-24 space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Puerto</label>
                      <Input
                        placeholder="9100"
                        value={edit.port}
                        onChange={(e) => setEdit(printer.id, "port", e.target.value)}
                        className="h-9"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isDirty && (
                      <Button
                        size="sm"
                        onClick={() => handleSave(printer.id)}
                        disabled={updatePrinter.isPending}
                        className="gap-1.5"
                      >
                        <Save className="h-3.5 w-3.5" /> Guardar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTest(printer.id, edit.ip, edit.port)}
                      disabled={status === "testing" || !edit.ip.trim()}
                      className="gap-1.5"
                    >
                      {statusIcon(status)}
                      {status === "testing" ? "Probando..." : "Test Conexión"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
