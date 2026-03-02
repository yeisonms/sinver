import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Upload, FileSpreadsheet } from "lucide-react";

interface Props {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function ImportProductsModal({ open, onClose, onSuccess }: Props) {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (selected) {
            setFile(selected);
        }
    };

    const parseBoolean = (val: any): boolean => {
        if (typeof val === "boolean") return val;
        if (typeof val === "string") {
            const lower = val.toLowerCase().trim();
            return lower === "sí" || lower === "si" || lower === "yes" || lower === "verdadero" || lower === "true" || lower === "1";
        }
        if (typeof val === "number") return val === 1;
        return false;
    };

    const parseNumber = (val: any): number => {
        if (typeof val === "number") return val;
        if (typeof val === "string") {
            // Remove any currency symbols, commas and try parsing
            const clean = val.replace(/[^0-9.-]+/g, "");
            const num = parseFloat(clean);
            return isNaN(num) ? 0 : num;
        }
        return 0;
    };

    const processImport = async () => {
        if (!file) return;

        setUploading(true);
        setProgress(0);

        try {
            // 1. Read Excel file
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: "array" });

            // Look for a sheet named 'Productos', fallback to the first one
            const targetSheetName = workbook.SheetNames.find(n => n.toLowerCase() === "productos") || workbook.SheetNames[0];
            const worksheet = workbook.Sheets[targetSheetName];

            // Parse to JSON array
            // Skip the first 4 lines since instruction headers usually occupy top rows.
            // But we will use defval to avoid dropping it entirely just skip header rows that dont make sense.
            // Instead, find the row that actually contains our header (Nombre)
            const rawMatrix: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            // Find the row index where "Nombre*" or "Nombre" appears
            let headerRowIndex = 0;
            for (let idx = 0; idx < Math.min(20, rawMatrix.length); idx++) {
                const row = rawMatrix[idx] || [];
                const foundHeader = row.some((cell: any) =>
                    String(cell).toLowerCase().includes("nombre") &&
                    !String(cell).toLowerCase().includes("plantilla")
                );
                if (foundHeader) {
                    headerRowIndex = idx;
                    break;
                }
            }

            // Reparse using the discovered header row
            const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { range: headerRowIndex, defval: "" });

            if (rawRows.length === 0) {
                throw new Error("El archivo parece estar vacío o no tiene el formato correcto.");
            }

            console.log("Primer fila (cabeceras en Excel):", Object.keys(rawRows[0] || {}));

            // 2. Fetch existing categories to map names to IDs
            const { data: existingCats, error: catError } = await supabase
                .from("categories")
                .select("id, name");

            if (catError) throw catError;

            // 3. Fetch existing products to avoid duplicates
            const { data: existingProds, error: prodError } = await supabase
                .from("products")
                .select("id, name");

            if (prodError) throw prodError;

            // Create in-memory dictionaries
            const categoryMap = new Map<string, string>();
            existingCats.forEach(c => categoryMap.set(c.name.toLowerCase().trim(), c.id));

            const productSet = new Set<string>();
            existingProds.forEach(p => productSet.add(p.name.toLowerCase().trim()));

            let importedCount = 0;
            let skippedCount = 0;
            let orderCounter = categoryMap.size + 1;

            // 4. Process Rows
            for (let i = 0; i < rawRows.length; i++) {
                const row = rawRows[i];

                // Normalize keys to lowercase, replace newlines/multiple spaces with a single space, and trim
                const normalizedRow: Record<string, any> = {};
                for (const [key, value] of Object.entries(row)) {
                    const cleanKey = key.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
                    normalizedRow[cleanKey] = value;
                }

                // Match user's specific columns (or fallbacks for slight variations)
                const name = normalizedRow["nombre*"] || normalizedRow["nombre"] || normalizedRow["name"] || "";
                const catNameRaw = normalizedRow["categoría*"] || normalizedRow["categoría"] || normalizedRow["categoria"] || normalizedRow["category"] || "";
                const description = normalizedRow["descripción"] || normalizedRow["descripcion"] || normalizedRow["description"] || null;
                const priceRaw = normalizedRow["precio*"] || normalizedRow["precio"] || normalizedRow["price"] || 0;
                const costRaw = normalizedRow["costo"] || normalizedRow["cost"] || 0;
                const isActiveRaw = normalizedRow["activo (sí / no)"] || normalizedRow["activo (sí/no)"] || normalizedRow["activo"] || normalizedRow["is_available"] || "sí";
                const isFavoriteRaw = normalizedRow["favorito (sí / no)"] || normalizedRow["favorito"] || normalizedRow["favorito*"] || normalizedRow["favoritos"] || normalizedRow["is_favorite"] || "no";
                const isTaxRaw = normalizedRow["iva incluido (sí / no)"] || normalizedRow["iva incluido"] || normalizedRow["iva"] || normalizedRow["is_tax_included"] || "no";
                const imageRaw = normalizedRow["url de la imagen"] || normalizedRow["url imagen"] || normalizedRow["image_url"] || null;

                console.log(`Fila cruda recibida de XLSX para ${name}:`, row);
                console.log(`Producto ${name} -> Raw ACT: "${isActiveRaw}", Raw FAV: "${isFavoriteRaw}" (${typeof isFavoriteRaw}), Raw TAX: "${isTaxRaw}"`);

                if (!name || !catNameRaw) {
                    console.warn(`Fila ${i + 2} omitida por falta de Nombre o Categoría:`, row);
                    // Skip rows missing mandatory fields
                    continue;
                }

                const catNameStr = String(catNameRaw).trim();
                const catKey = catNameStr.toLowerCase();
                const prodKey = String(name).trim().toLowerCase();

                // 4.1 Skip if product name already exists
                if (productSet.has(prodKey)) {
                    console.warn(`Producto omitido por nombre duplicado: ${name}`);
                    skippedCount++;
                    continue;
                }

                let categoryId = categoryMap.get(catKey);

                // 4.2 Create category if it doesn't exist
                if (!categoryId) {
                    const { data: newCat, error: insertCatError } = await supabase
                        .from("categories")
                        .insert({
                            name: catNameStr,
                            sort_order: orderCounter++,
                            is_visible_online: true,
                            show_in_app: true,
                            show_in_store: true,
                            show_in_qr: true
                        })
                        .select("id")
                        .single();

                    if (insertCatError) throw insertCatError;

                    categoryId = newCat.id;
                    categoryMap.set(catKey, categoryId);
                }

                // 4.3 Insert Product
                const { error: insertProdError } = await supabase
                    .from("products")
                    .insert({
                        name: String(name).trim(),
                        description: description ? String(description).trim() : null,
                        category_id: categoryId,
                        price: parseNumber(priceRaw),
                        cost: parseNumber(costRaw),
                        is_available: parseBoolean(isActiveRaw),
                        is_favorite: parseBoolean(isFavoriteRaw),
                        is_tax_included: parseBoolean(isTaxRaw),
                        image_url: imageRaw ? String(imageRaw).trim() : null
                    });

                if (insertProdError) throw insertProdError;

                importedCount++;
                setProgress(Math.round(((i + 1) / rawRows.length) * 100));
            }

            if (importedCount === 0 && skippedCount === 0) {
                toast({
                    title: "Ningún producto importado",
                    description: "No se encontraron filas con las columnas Nombre y Categoría. Verifica los títulos.",
                    variant: "destructive"
                });
            } else {
                toast({
                    title: "Importación finalizada",
                    description: `Se insertaron ${importedCount} productos nuevos. Se omitieron ${skippedCount} duplicados.`,
                });
                if (importedCount > 0) {
                    onSuccess();
                }
            }

            handleClose();

        } catch (err: any) {
            toast({
                title: "Error de Importación",
                description: err.message || "Ocurrió un error al procesar el archivo Excel.",
                variant: "destructive"
            });
        } finally {
            setUploading(false);
        }
    };

    const handleClose = () => {
        if (uploading) return;
        setFile(null);
        setProgress(0);
        if (fileInputRef.current) fileInputRef.current.value = "";
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-green-600" />
                        Importación Masiva de Productos
                    </DialogTitle>
                    <DialogDescription>
                        Sube un archivo Excel (.xlsx) o CSV. El sistema detectará automáticamente las categorías nuevas y las creará si es necesario.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-6 space-y-6">
                    <div
                        className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center bg-gray-50/50 hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => !uploading && fileInputRef.current?.click()}
                    >
                        <input
                            type="file"
                            className="hidden"
                            ref={fileInputRef}
                            accept=".xlsx,.xls,.csv"
                            onChange={handleFileChange}
                            disabled={uploading}
                        />

                        <div className="rounded-full bg-green-100 p-3 mb-4">
                            <Upload className="h-6 w-6 text-green-600" />
                        </div>

                        {file ? (
                            <div className="text-center">
                                <p className="font-medium text-sm text-gray-900 truncate max-w-[200px]">{file.name}</p>
                                <p className="text-xs text-gray-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                            </div>
                        ) : (
                            <div className="text-center">
                                <p className="text-sm font-medium text-gray-900">Haz clic para buscar un archivo</p>
                                <p className="text-xs text-gray-500 mt-1">Solo formatos .xlsx o .csv</p>
                            </div>
                        )}
                    </div>

                    <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800">
                        <p className="font-semibold mb-1">Columnas requeridas en tu plantilla:</p>
                        <p><code>Nombre*</code>, <code>Categoría*</code>, <code>Descripción</code>, <code>Precio</code>, <code>Costo</code>, <code>Activo (SÍ / NO)</code>, <code>Favorito</code>, <code>IVA Incluido</code>, <code>URL de la imagen</code></p>
                    </div>

                    {uploading && (
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Procesando e insertando...</span>
                                <span>{progress}%</span>
                            </div>
                            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary transition-all duration-300 ease-out"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="sm:justify-between">
                    <Button variant="ghost" onClick={handleClose} disabled={uploading}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={processImport}
                        disabled={!file || uploading}
                        className="bg-green-600 hover:bg-green-700 text-white shadow-sm"
                    >
                        {uploading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Importando...
                            </>
                        ) : (
                            'Confirmar Importación'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
