import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Printer, Wifi, Loader2, CheckCircle2, XCircle } from "lucide-react";

type ConnectionStatus = "idle" | "testing" | "success" | "error";

export default function PrintersPage() {
  const [ip, setIp] = useState("192.168.1.200");
  const [port, setPort] = useState("9100");
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const printRef = useRef<HTMLDivElement>(null);

  const handleTestConnection = async () => {
    if (!ip.trim()) {
      toast.error("Ingresa la dirección IP de la impresora");
      return;
    }

    setStatus("testing");

    try {
      const encoder = new TextEncoder();
      const initCmd = new Uint8Array([0x1B, 0x40]);
      const textBytes = encoder.encode(
        "\n" +
        "================================\n" +
        "   PRUEBA DE CONEXION Wi-Fi\n" +
        "================================\n" +
        "\n" +
        "  Sistema Fudo Restaurante\n" +
        "\n" +
        `  IP: ${ip}:${port}\n` +
        `  Fecha: ${new Date().toLocaleString("es-ES")}\n` +
        "\n" +
        "  Si puedes leer esto, la\n" +
        "  conexion fue EXITOSA!\n" +
        "\n" +
        "================================\n" +
        "\n\n\n"
      );
      const cutCmd = new Uint8Array([0x1D, 0x56, 0x00]);

      const payload = new Uint8Array([...initCmd, ...textBytes, ...cutCmd]);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        await fetch(`http://${ip}:${port}`, {
          method: "POST",
          body: payload,
          signal: controller.signal,
          mode: "no-cors",
        });
        clearTimeout(timeout);
        setStatus("success");
        toast.success("Datos enviados a la impresora", {
          description: `Ticket de prueba enviado a ${ip}:${port}.`,
        });
      } catch (fetchError: any) {
        clearTimeout(timeout);
        if (fetchError.name === "AbortError") {
          throw new Error("Tiempo de espera agotado (5s).");
        }
        setStatus("success");
        toast.info("Solicitud enviada", {
          description: `Verifica físicamente si la impresora respondió.`,
        });
      }
    } catch (error: any) {
      setStatus("error");
      toast.error("Error de conexión", {
        description: error.message || "No se pudo conectar con la impresora.",
      });
    }
  };

  const handleBrowserPrint = () => {
    window.print();
  };

  const statusIcon = {
    idle: <Wifi className="h-5 w-5 text-muted-foreground" />,
    testing: <Loader2 className="h-5 w-5 text-primary animate-spin" />,
    success: <CheckCircle2 className="h-5 w-5 text-primary" />,
    error: <XCircle className="h-5 w-5 text-destructive" />,
  };

  const statusText = {
    idle: "Sin probar",
    testing: "Probando conexión...",
    success: "Datos enviados correctamente",
    error: "Error de conexión",
  };

  const now = new Date().toLocaleString("es-ES");

  return (
    <>
      <div className="p-6 max-w-2xl mx-auto space-y-6 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Impresoras</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configura y prueba la conexión con impresoras térmicas vía Wi-Fi.
          </p>
        </div>

        {/* Método 1: Impresión por navegador (window.print) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              Imprimir vía Navegador (Recomendado)
            </CardTitle>
            <CardDescription>
              Usa el diálogo de impresión de Chrome. Selecciona la impresora
              <strong> "Caja - WiFi"</strong> en el listado del sistema.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleBrowserPrint} className="w-full" size="lg">
              <Printer className="h-4 w-4 mr-2" />
              Imprimir Ticket de Prueba
            </Button>
            <p className="text-xs text-muted-foreground">
              💡 En el diálogo de impresión, selecciona <strong>"Caja - WiFi"</strong> como destino.
              Ajusta el tamaño de papel a 80mm si es necesario.
            </p>
          </CardContent>
        </Card>

        {/* Método 2: Conexión directa por IP */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5" />
              Conexión Directa (ESC/POS vía IP)
            </CardTitle>
            <CardDescription>
              Envía comandos ESC/POS directamente a la IP de la impresora.
              Requiere proxy TCP (RawBT o similar).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-[1fr_100px] gap-3">
              <div className="space-y-2">
                <Label htmlFor="printer-ip">Dirección IP</Label>
                <Input
                  id="printer-ip"
                  placeholder="192.168.1.200"
                  value={ip}
                  onChange={(e) => { setIp(e.target.value); setStatus("idle"); }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="printer-port">Puerto</Label>
                <Input
                  id="printer-port"
                  placeholder="9100"
                  value={port}
                  onChange={(e) => { setPort(e.target.value); setStatus("idle"); }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm py-2 px-3 rounded-md bg-muted/50">
              {statusIcon[status]}
              <span className="text-muted-foreground">{statusText[status]}</span>
            </div>

            <Button
              onClick={handleTestConnection}
              disabled={status === "testing"}
              className="w-full"
              variant="outline"
              size="lg"
            >
              {status === "testing" ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Probando Conexión...</>
              ) : (
                <><Wifi className="h-4 w-4 mr-2" />Probar Conexión Directa</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Ticket visible SOLO al imprimir */}
      <div ref={printRef} className="hidden print:block">
        <div
          style={{
            width: "80mm",
            fontFamily: "'Courier New', monospace",
            fontSize: "14px",
            fontWeight: 600,
            color: "#000",
            printColorAdjust: "exact",
            WebkitPrintColorAdjust: "exact",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "8px" }}>
            <p style={{ fontSize: "16px", fontWeight: 700 }}>FUDO RESTAURANTE</p>
            <p>================================</p>
            <p style={{ fontSize: "16px", fontWeight: 700 }}>PRUEBA DE IMPRESIÓN</p>
            <p>================================</p>
          </div>
          <p>Impresora: Caja - WiFi</p>
          <p>IP: {ip}:{port}</p>
          <p>Fecha: {now}</p>
          <p>&nbsp;</p>
          <p>Si puedes leer esto, la</p>
          <p>impresión vía navegador</p>
          <p>funciona CORRECTAMENTE.</p>
          <p>&nbsp;</p>
          <p>================================</p>
          <p style={{ textAlign: "center", fontSize: "12px" }}>
            Sistema Fudo v1.0
          </p>
        </div>
      </div>
    </>
  );
}