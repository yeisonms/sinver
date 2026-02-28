import { useState, useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Copy, Download, CheckCircle2, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function MenuQrTab({ info }: { info: any }) {
    const [copied, setCopied] = useState(false);
    const qrRef = useRef<HTMLDivElement>(null);

    // Create an explicit URL focusing on the /menu digital page.
    const menuUrl = `${window.location.origin}/menu`;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(menuUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy text", err);
        }
    };

    const downloadQRCode = () => {
        const canvas = qrRef.current?.querySelector("canvas");
        if (!canvas) return;

        // Convert canvas to a high-quality PNG data URL
        const pngUrl = canvas.toDataURL("image/png");

        // Create an invisible anchor node to trigger download
        const downloadLink = document.createElement("a");
        downloadLink.href = pngUrl;
        downloadLink.download = "QR_Menu_Restaurante.png";
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    };

    return (
        <Card className="max-w-xl mx-auto shadow-sm">
            <CardHeader className="text-center pb-2">
                <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
                    Código QR y Enlace del Menú
                </CardTitle>
                <CardDescription>
                    Comparte este código QRs o enlace público con tus clientes para que accedan al menú digital y puedan pedir online o desde su mesa.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8 flex flex-col items-center pt-4">

                {/* Public URL Field */}
                <div className="w-full max-w-sm space-y-2">
                    <Label className="text-muted-foreground font-semibold">Enlace Público</Label>
                    <div className="flex gap-2">
                        <Input
                            readOnly
                            value={menuUrl}
                            className="bg-muted focus-visible:ring-0 cursor-text"
                        />
                        <Button variant="secondary" onClick={handleCopy} className="shrink-0 gap-2 min-w-[140px] transition-all">
                            {copied ? (
                                <>
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    Copiado
                                </>
                            ) : (
                                <>
                                    <Copy className="h-4 w-4" />
                                    📋 Copiar Enlace
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                {/* High-Resolution QR Canvas area */}
                <div
                    className="p-6 bg-white rounded-2xl shadow-sm border border-border/50 flex flex-col items-center justify-center transition-all hover:shadow-md"
                    ref={qrRef}
                >
                    <QRCodeCanvas
                        value={menuUrl}
                        size={250}
                        bgColor={"#ffffff"}
                        fgColor={"#000000"}
                        level={"H"} // Maximum Error Correction for overlaying images
                        includeMargin={true}
                        imageSettings={
                            info?.logo_url
                                ? {
                                    src: info.logo_url,
                                    height: 60, // ~ 24% of 250 to stay legible and prominent
                                    width: 60,
                                    excavate: true,
                                }
                                : undefined
                        }
                    />
                </div>

                {/* Download Call to Action */}
                <Button
                    onClick={downloadQRCode}
                    size="lg"
                    className="w-full max-w-sm gap-2 h-12 text-md font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                    <Download className="h-5 w-5" />
                    ⬇️ Descargar Código QR
                </Button>
            </CardContent>
        </Card>
    );
}
