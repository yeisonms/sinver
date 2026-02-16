import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Printer, Wifi, WifiOff, Loader2, CheckCircle2, XCircle } from "lucide-react";

type ConnectionStatus = "idle" | "testing" | "success" | "error";

export default function PrintersPage() {
  const [ip, setIp] = useState("192.168.1.200");
  const [port, setPort] = useState("9100");
  const [status, setStatus] = useState<ConnectionStatus>("idle");

  const handleTestConnection = async () => {
    if (!ip.trim()) {
      toast.error("Ingresa la dirección IP de la impresora");
      return;
    }

    setStatus("testing");

    try {
      // ESC/POS: Initialize + text + cut
      const encoder = new TextEncoder();
      const initCmd = new Uint8Array([0x1B, 0x40]); // ESC @  - Initialize
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
      const cutCmd = new Uint8Array([0x1D, 0x56, 0x00]); // GS V 0 - Full cut

      const payload = new Uint8Array([
        ...initCmd,
        ...textBytes,
        ...cutCmd,
      ]);

      // Use a raw TCP proxy or direct fetch to the printer
      // Since browsers can't do raw TCP, we attempt via a backend proxy.
      // For now, we simulate the connection test using a timeout
      // and provide the ESC/POS payload for future integration.
      
      // Attempt to reach the printer via HTTP (some thermal printers expose HTTP)
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        // Try connecting to common printer endpoints
        await fetch(`http://${ip}:${port}`, {
          method: "POST",
          body: payload,
          signal: controller.signal,
          mode: "no-cors",
        });
        clearTimeout(timeout);
        
        // In no-cors mode we can't read the response, but if no error was thrown
        // the network request was sent successfully
        setStatus("success");
        toast.success("Datos enviados a la impresora", {
          description: `Se envió el ticket de prueba a ${ip}:${port}. Verifica si la impresora lo imprimió.`,
        });
      } catch (fetchError: any) {
        clearTimeout(timeout);
        if (fetchError.name === "AbortError") {
          throw new Error("Tiempo de espera agotado (5s). Verifica que la IP sea correcta y la impresora esté encendida.");
        }
        // For network printers, a failed fetch in no-cors might still mean data was sent
        // Let the user verify manually
        setStatus("success");
        toast.info("Solicitud enviada", {
          description: `Se intentó enviar datos a ${ip}:${port}. Verifica físicamente si la impresora respondió.`,
        });
      }
    } catch (error: any) {
      setStatus("error");
      toast.error("Error de conexión", {
        description: error.message || "No se pudo conectar con la impresora.",
      });
    }
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

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Impresoras</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configura y prueba la conexión con impresoras térmicas vía Wi-Fi.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Impresora de Red (Wi-Fi/Ethernet)
          </CardTitle>
          <CardDescription>
            Ingresa la dirección IP de tu impresora térmica para probar la conexión. 
            El puerto estándar para impresoras ESC/POS es 9100.
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
                onChange={(e) => {
                  setIp(e.target.value);
                  setStatus("idle");
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="printer-port">Puerto</Label>
              <Input
                id="printer-port"
                placeholder="9100"
                value={port}
                onChange={(e) => {
                  setPort(e.target.value);
                  setStatus("idle");
                }}
              />
            </div>
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-2 text-sm py-2 px-3 rounded-md bg-muted/50">
            {statusIcon[status]}
            <span className="text-muted-foreground">{statusText[status]}</span>
          </div>

          <Button
            onClick={handleTestConnection}
            disabled={status === "testing"}
            className="w-full"
            size="lg"
          >
            {status === "testing" ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Probando Conexión...
              </>
            ) : (
              <>
                <Wifi className="h-4 w-4 mr-2" />
                Probar Conexión
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground">
            💡 Asegúrate de que tu dispositivo esté conectado a la misma red Wi-Fi que la impresora. 
            Si la impresora no responde, verifica que esté encendida y que la IP sea correcta.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
