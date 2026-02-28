import { useState } from "react";
import { usePrinters, useUpdatePrinter, useCreatePrinter, useDeletePrinter } from "@/hooks/usePrinters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Printer, Wifi, Loader2, CheckCircle2, XCircle, Save, Plus, Trash2 } from "lucide-react";

type TestStatus = "idle" | "testing" | "success" | "error";

export default function PrintersPage() {
  const { data: printers = [], isLoading } = usePrinters();
  const updatePrinter = useUpdatePrinter();
  const createPrinter = useCreatePrinter();
  const deletePrinter = useDeletePrinter();

  const [edits, setEdits] = useState<Record<string, { ip: string; port: string }>>({});
  const [testStatus, setTestStatus] = useState<Record<string, TestStatus>>({});

  // Create Modal State
  const [createOpen, setCreateOpen] = useState(false);
  const [newPrinter, setNewPrinter] = useState({ name: "", ip_address: "", port: "9100" });
  const [isCreating, setIsCreating] = useState(false);

  const getEdit = (id: string, ip: string | null, port: number | null) => {
    if (edits[id]) return edits[id];
    return { ip: ip || "", port: String(port || 9100) };
  };

  const setEdit = (id: string, field: "ip" | "port", value: string) => {
    setEdits((prev) => {
      const printer = printers.find((p) => p.id === id);
      const base = prev[id] ?? { ip: printer?.ip_address || "", port: String(printer?.port || 9100) };
      return { ...prev, [id]: { ...base, [field]: value } };
    });
    setTestStatus((prev) => ({ ...prev, [id]: "idle" }));
  };

  const handleSave = async (id: string) => {
    const edit = edits[id];
    if (!edit?.ip?.trim()) {
      toast.error("Ingresa una IP válida");
      return;
    }
    try {
      console.log("[PrintersPage] Saving:", { id, ip: edit.ip.trim(), port: parseInt(edit.port) || 9100 });
      await updatePrinter.mutateAsync({ id, ip_address: edit.ip.trim(), port: parseInt(edit.port) || 9100 });
      setEdits((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      toast.success("Impresora actualizada");
    } catch (e: any) {
      console.error("[PrintersPage] Save error:", e);
      toast.error(e.message);
    }
  };

  const handleCreate = async () => {
    if (!newPrinter.name.trim() || !newPrinter.ip_address.trim()) {
      toast.error("El nombre y la IP son requeridos");
      return;
    }
    setIsCreating(true);
    try {
      await createPrinter.mutateAsync({
        name: newPrinter.name.trim(),
        ip_address: newPrinter.ip_address.trim(),
        port: parseInt(newPrinter.port) || 9100
      });
      toast.success("Impresora creada exitosamente");
      setCreateOpen(false);
      setNewPrinter({ name: "", ip_address: "", port: "9100" });
    } catch (e: any) {
      toast.error("Error al crear impresora: " + e.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar la impresora "${name}"?`)) return;
    try {
      await deletePrinter.mutateAsync(id);
      toast.success("Impresora eliminada");
    } catch (e: any) {
      toast.error("Error al eliminar: " + e.message);
    }
  };

  const handleTest = async (id: string, ip: string, port: string, name: string) => {
    if (!ip.trim()) { toast.error("Ingresa una IP"); return; }
    setTestStatus((prev) => ({ ...prev, [id]: "testing" }));

    try {
      const encoder = new TextEncoder();
      const ESC = 0x1B;
      const GS = 0x1D;
      const parts: Uint8Array[] = [];

      parts.push(new Uint8Array([ESC, 0x40])); // Initialize
      parts.push(new Uint8Array([ESC, 0x45, 0x01])); // Bold ON
      parts.push(new Uint8Array([GS, 0x21, 0x11]));  // Double size
      parts.push(encoder.encode(`TEST OK\n`));
      parts.push(new Uint8Array([GS, 0x21, 0x00]));  // Normal size
      parts.push(new Uint8Array([ESC, 0x45, 0x00])); // Bold OFF
      parts.push(encoder.encode(`${name}\n`));
      parts.push(encoder.encode("================================\n"));
      parts.push(encoder.encode(`${new Date().toLocaleString("es-CO")}\n`));
      parts.push(encoder.encode("================================\n"));
      parts.push(encoder.encode("\n\n\n\n\n"));
      parts.push(new Uint8Array([GS, 0x56, 0x00])); // Full cut

      const totalLen = parts.reduce((s, p) => s + p.length, 0);
      const payload = new Uint8Array(totalLen);
      let offset = 0;
      for (const part of parts) {
        payload.set(part, offset);
        offset += part.length;
      }

      const portNum = parseInt(port) || 9100;

      // Use RawBT on Android, HTTP otherwise
      if (/Android/i.test(navigator.userAgent)) {
        let binary = "";
        for (let i = 0; i < payload.length; i++) {
          binary += String.fromCharCode(payload[i]);
        }
        const base64 = btoa(binary);
        window.location.href = `rawbt:base64,${base64}`;
      } else {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        await fetch(`http://${ip}:${portNum}`, {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: new Blob([payload as any]),
          signal: controller.signal,
          mode: "no-cors",
        }).catch(() => { });

        clearTimeout(timeout);
      }

      setTestStatus((prev) => ({ ...prev, [id]: "success" }));
      toast.success(`Datos enviados a ${name} (${ip})`);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Impresoras</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configura la IP de cada impresora térmica. Las categorías asignadas determinan qué items se imprimen en cada una.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2 whitespace-nowrap">
          <Plus className="h-4 w-4" /> Nueva Impresora
        </Button>
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
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Printer className="h-4 w-4" />
                      {printer.name}
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">
                      Las categorías asignadas a esta impresora se envían automáticamente al confirmar pedidos.
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(printer.id, printer.name)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
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
                      onClick={() => handleTest(printer.id, edit.ip, edit.port, printer.name)}
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

      {/* Dialogo Creacion */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Impresora</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre de la Estación</Label>
              <Input
                placeholder="Ej: Barra de Bebidas"
                value={newPrinter.name}
                onChange={(e) => setNewPrinter(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="flex gap-3">
              <div className="space-y-2 flex-1">
                <Label>Dirección IP local</Label>
                <Input
                  placeholder="192.168.1.xxx"
                  value={newPrinter.ip_address}
                  onChange={(e) => setNewPrinter(prev => ({ ...prev, ip_address: e.target.value }))}
                />
              </div>
              <div className="space-y-2 w-24">
                <Label>Puerto</Label>
                <Input
                  placeholder="9100"
                  value={newPrinter.port}
                  onChange={(e) => setNewPrinter(prev => ({ ...prev, port: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Crear Impresora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
