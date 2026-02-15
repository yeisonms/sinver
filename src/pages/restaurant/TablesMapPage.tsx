import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import { useAreas, useTablesByArea } from "@/hooks/useTables";
import { useAuth } from "@/contexts/AuthContext";
import { useOpenTable } from "@/hooks/useOpenTable";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Table } from "@/types/database";

const GRID_ROWS = 8;
const GRID_COLS = 10;

export default function TablesMapPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
  const { data: areas = [], isLoading: areasLoading } = useAreas();
  const [activeAreaId, setActiveAreaId] = useState<string | null>(null);

  const selectedAreaId = activeAreaId || (areas.length > 0 ? areas[0].id : null);
  const { data: tables = [] } = useTablesByArea(selectedAreaId);

  // Fetch waiter names for occupied tables
  const waiterIds = tables
    .filter((t) => t.status === "ocupada" && t.current_waiter_id)
    .map((t) => t.current_waiter_id!);
  const { data: waiterProfiles = [] } = useQuery({
    queryKey: ["waiter-profiles", waiterIds],
    queryFn: async () => {
      if (waiterIds.length === 0) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", waiterIds);
      if (error) throw error;
      return data as { id: string; full_name: string | null }[];
    },
    enabled: waiterIds.length > 0,
  });
  const waiterNameMap = Object.fromEntries(
    waiterProfiles.map((p) => [p.id, p.full_name ?? ""])
  );

  const openTable = useOpenTable();

  // Dialog state
  const [dialogTable, setDialogTable] = useState<Table | null>(null);
  const [dinerCount, setDinerCount] = useState(1);
  const [comment, setComment] = useState("");

  const tableAt = (x: number, y: number) =>
    tables.find((t) => t.x_position === x && t.y_position === y);

  const handleTableClick = (table: Table) => {
    if (table.status === "libre") {
      setDialogTable(table);
      setDinerCount(1);
      setComment("");
    } else if (table.status === "ocupada" && table.current_order_id) {
      navigate(`/restaurant/tables/${table.current_order_id}/take-order`);
    }
  };

  const handleOpenTable = async () => {
    if (!dialogTable || !user) return;
    try {
      const order = await openTable.mutateAsync({
        tableId: dialogTable.id,
        areaId: dialogTable.area_id!,
        waiterId: user.id,
        dinerCount: dinerCount,
        comment: comment || null,
      });
      toast.success("Mesa abierta");
      setDialogTable(null);
      navigate(`/restaurant/tables/${order.id}/take-order`);
    } catch {
      toast.error("Error al abrir mesa");
    }
  };

  // Open table form content (shared between Dialog and Drawer)
  const openTableForm = (
    <div className="space-y-5 px-1">
      <div>
        <Label className="text-base font-medium">Personas</Label>
        <div className="flex items-center gap-4 mt-2">
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-xl text-lg"
            onClick={() => setDinerCount(Math.max(1, dinerCount - 1))}
          >
            <Minus className="h-5 w-5" />
          </Button>
          <span className="text-2xl font-bold w-10 text-center">{dinerCount}</span>
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-xl text-lg"
            onClick={() => setDinerCount(dinerCount + 1)}
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </div>
      <div className="border-t border-border pt-4">
        <Label className="text-base font-medium">Camarero</Label>
        <p className="text-sm text-muted-foreground mt-1">{profile?.full_name ?? user?.email ?? "—"}</p>
      </div>
      <div className="border-t border-border pt-4">
        <Label className="text-base font-medium">Comentario</Label>
        <Textarea
          placeholder="Notas opcionales..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          className="mt-2"
        />
      </div>
    </div>
  );

  const openTableButton = (
    <Button
      onClick={handleOpenTable}
      disabled={openTable.isPending}
      className="w-full h-12 text-base font-semibold"
    >
      {openTable.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
      Abrir mesa
    </Button>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Area Tabs */}
      {areas.length > 0 && (
        <div className="flex items-center gap-0 px-4 md:px-6 border-b border-border bg-muted/30 overflow-x-auto">
          {areas.map((area) => {
            const isActive = area.id === selectedAreaId;
            return (
              <button
                key={area.id}
                onClick={() => setActiveAreaId(area.id)}
                className={`px-4 md:px-5 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {area.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Grid Canvas */}
      <div className="flex-1 p-4 md:p-6 overflow-auto">
        {areasLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !selectedAreaId ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            No hay salas configuradas
          </div>
        ) : isMobile ? (
          /* Mobile: simple grid of table buttons */
          <div className="grid grid-cols-3 gap-3">
            {tables.map((table) => {
              const isOccupied = table.status === "ocupada";
              return (
                <button
                  key={table.id}
                  onClick={() => handleTableClick(table)}
                  className={`flex flex-col items-center justify-center gap-0.5 text-white font-bold aspect-square transition-all ${
                    table.shape === "round" ? "rounded-full" : "rounded-xl"
                  }`}
                  style={{
                    backgroundColor: isOccupied
                      ? "hsl(0 72% 51%)"
                      : "hsl(80 40% 75%)",
                    minHeight: 80,
                  }}
                >
                  <span className="text-lg leading-none">{table.name}</span>
                  {isOccupied && table.current_waiter_id && waiterNameMap[table.current_waiter_id] && (
                    <span className="text-[10px] leading-tight opacity-90 max-w-full truncate px-1 text-center">
                      {waiterNameMap[table.current_waiter_id]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          /* Desktop: positioned grid */
          <div
            className="grid gap-1"
            style={{
              gridTemplateColumns: `repeat(${GRID_COLS}, 80px)`,
              gridTemplateRows: `repeat(${GRID_ROWS}, 80px)`,
            }}
          >
            {Array.from({ length: GRID_ROWS }).map((_, y) =>
              Array.from({ length: GRID_COLS }).map((_, x) => {
                const table = tableAt(x, y);

                if (table) {
                  const isOccupied = table.status === "ocupada";
                  return (
                    <button
                      key={`${x}-${y}`}
                      onClick={() => handleTableClick(table)}
                      className={`flex flex-col items-center justify-center gap-0.5 text-white font-bold transition-all ${
                        table.shape === "round" ? "rounded-full" : "rounded-lg"
                      }`}
                      style={{
                        backgroundColor: isOccupied
                          ? "hsl(0 72% 51%)"
                          : "hsl(142 71% 45%)",
                        width: table.size_label === "medium" ? 76 : 64,
                        height: table.size_label === "medium" ? 76 : 64,
                        margin: "auto",
                      }}
                    >
                      <span className="text-sm leading-none">{table.name}</span>
                      {isOccupied && table.current_waiter_id && waiterNameMap[table.current_waiter_id] && (
                        <span className="text-[9px] leading-tight opacity-90 max-w-full truncate px-1 text-center">
                          {waiterNameMap[table.current_waiter_id]}
                        </span>
                      )}
                    </button>
                  );
                }

                return (
                  <div
                    key={`${x}-${y}`}
                    className="border border-dashed border-border/30 rounded-md"
                  />
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Open Table - Drawer on mobile, Dialog on desktop */}
      {isMobile ? (
        <Drawer open={!!dialogTable} onOpenChange={(v) => !v && setDialogTable(null)}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle className="text-center text-xl">
                Mesa {dialogTable?.name}
                <span className="block text-sm font-normal text-muted-foreground mt-0.5">Libre</span>
              </DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-2">{openTableForm}</div>
            <DrawerFooter>
              {openTableButton}
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={!!dialogTable} onOpenChange={(v) => !v && setDialogTable(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Abrir Mesa {dialogTable?.name}</DialogTitle>
            </DialogHeader>
            {openTableForm}
            <DialogFooter>
              {openTableButton}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
