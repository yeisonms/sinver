import { useState, useMemo } from "react";
import { useAreas, useTablesByArea, useMoveTable } from "@/hooks/useTables";
import { Loader2 } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { Table } from "@/types/database";

interface MoveTableDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sourceTable: Table | null;
}

export function MoveTableDialog({ open, onOpenChange, sourceTable }: MoveTableDialogProps) {
    const { data: areas = [], isLoading: areasLoading } = useAreas();
    const [activeAreaId, setActiveAreaId] = useState<string | null>(null);

    // Set default active area when areas load
    const selectedAreaId = activeAreaId || (areas.length > 0 ? areas[0].id : null);

    const { data: tables = [], isLoading: tablesLoading } = useTablesByArea(selectedAreaId);
    const moveTable = useMoveTable();

    // Filter only free tables
    const freeTables = useMemo(() => tables.filter((t) => t.status === "libre"), [tables]);

    const handleTableSelect = async (targetTable: Table) => {
        if (!sourceTable || !sourceTable.current_order_id) {
            toast.error("Error: Mesa de origen no válida.");
            return;
        }

        try {
            await moveTable.mutateAsync({
                sourceTableId: sourceTable.id,
                targetTableId: targetTable.id,
                orderId: sourceTable.current_order_id,
                waiterId: sourceTable.current_waiter_id,
                sourceAreaId: sourceTable.area_id!,
                targetAreaId: targetTable.area_id!,
            });

            toast.success(`Pedido trasladado a Mesa ${targetTable.name}`);
            onOpenChange(false);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            toast.error(err?.message || "Error al trasladar la mesa");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col p-0 overflow-hidden gap-0">
                <DialogHeader className="p-6 pb-4 border-b">
                    <DialogTitle className="text-xl">Trasladar Mesa {sourceTable?.name}</DialogTitle>
                    <p className="text-sm text-muted-foreground mt-1">Selecciona una mesa disponible (color verde) para mover este pedido.</p>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col bg-secondary/5">
                    {/* Areas Tab List */}
                    {areas.length > 0 && (
                        <div className="flex items-center gap-2 px-6 py-3 border-b bg-background overflow-x-auto shrink-0">
                            {areas.map((area) => {
                                const isActive = area.id === selectedAreaId;
                                return (
                                    <button
                                        key={area.id}
                                        onClick={() => setActiveAreaId(area.id)}
                                        className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-all whitespace-nowrap ${isActive
                                            ? "bg-primary text-primary-foreground shadow-sm"
                                            : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
                                            }`}
                                    >
                                        {area.name}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Tables Grid */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {areasLoading || tablesLoading ? (
                            <div className="flex justify-center p-8">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : freeTables.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                No hay mesas libres en esta área.
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                {freeTables.map((table) => (
                                    <button
                                        key={table.id}
                                        onClick={() => handleTableSelect(table)}
                                        disabled={moveTable.isPending}
                                        className={`flex flex-col items-center justify-center gap-1 text-white font-bold aspect-square transition-all hover:scale-105 active:scale-95 shadow-sm ${table.shape === "round" ? "rounded-full" : "rounded-2xl"
                                            } ${moveTable.isPending ? "opacity-50 cursor-not-allowed" : ""}`}
                                        style={{
                                            backgroundColor: "#10b981", // Emerald 500
                                        }}
                                    >
                                        <span className="text-xl leading-none">{table.name}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
