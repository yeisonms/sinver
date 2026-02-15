import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAreas, useCreateArea, useTablesByArea, useUpsertTable, useDeleteTable } from "@/hooks/useTables";
import { toast } from "sonner";
import type { Table } from "@/types/database";

const GRID_ROWS = 8;
const GRID_COLS = 10;

export default function TablesPage() {
  const { data: areas = [], isLoading: areasLoading } = useAreas();
  const [activeAreaId, setActiveAreaId] = useState<string | null>(null);
  const [newAreaOpen, setNewAreaOpen] = useState(false);
  const [newAreaName, setNewAreaName] = useState("");
  const createArea = useCreateArea();

  // Auto-select first area
  const selectedAreaId = activeAreaId || (areas.length > 0 ? areas[0].id : null);
  const activeArea = areas.find((a) => a.id === selectedAreaId);

  const { data: tables = [] } = useTablesByArea(selectedAreaId);
  const upsertTable = useUpsertTable();
  const deleteTable = useDeleteTable();

  const [selectedCell, setSelectedCell] = useState<{ x: number; y: number } | null>(null);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formShape, setFormShape] = useState<"square" | "round">("square");
  const [formSize, setFormSize] = useState<"small" | "medium">("small");
  const [formCapacity, setFormCapacity] = useState("4");

  const tableAt = (x: number, y: number) =>
    tables.find((t) => t.x_position === x && t.y_position === y);

  const handleCellClick = (x: number, y: number) => {
    const existing = tableAt(x, y);
    if (existing) {
      setSelectedTable(existing);
      setSelectedCell({ x, y });
      setFormName(existing.name);
      setFormShape(existing.shape || "square");
      setFormSize(existing.size_label || "small");
      setFormCapacity(String(existing.capacity));
    } else {
      setSelectedTable(null);
      setSelectedCell({ x, y });
      setFormName("");
      setFormShape("square");
      setFormSize("small");
      setFormCapacity("4");
    }
  };

  const handleSave = async () => {
    if (!selectedAreaId || !selectedCell || !formName.trim()) return;
    try {
      await upsertTable.mutateAsync({
        id: selectedTable?.id || crypto.randomUUID(),
        name: formName.trim(),
        area_id: selectedAreaId,
        x_position: selectedCell.x,
        y_position: selectedCell.y,
        shape: formShape,
        size_label: formSize,
        capacity: parseInt(formCapacity) || 4,
      });
      toast.success(selectedTable ? "Mesa actualizada" : "Mesa creada");
      setSelectedCell(null);
      setSelectedTable(null);
    } catch {
      toast.error("Error al guardar mesa");
    }
  };

  const handleDelete = async () => {
    if (!selectedTable || !selectedAreaId) return;
    try {
      await deleteTable.mutateAsync({ id: selectedTable.id, areaId: selectedAreaId });
      toast.success("Mesa eliminada");
      setSelectedCell(null);
      setSelectedTable(null);
    } catch {
      toast.error("Error al eliminar mesa");
    }
  };

  const handleCreateArea = async () => {
    if (!newAreaName.trim()) return;
    try {
      const area = await createArea.mutateAsync(newAreaName.trim());
      setActiveAreaId(area.id);
      setNewAreaOpen(false);
      setNewAreaName("");
      toast.success("Sala creada");
    } catch {
      toast.error("Error al crear sala");
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <h1 className="text-xl font-bold text-foreground">Salas y Mesas</h1>
        <Button size="sm" onClick={() => setNewAreaOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nueva Sala
        </Button>
      </div>

      {/* Area Tabs */}
      {areas.length > 0 && (
        <div className="flex items-center gap-0 px-6 border-b border-border bg-muted/30">
          {areas.map((area) => {
            const isActive = area.id === selectedAreaId;
            return (
              <button
                key={area.id}
                onClick={() => {
                  setActiveAreaId(area.id);
                  setSelectedCell(null);
                  setSelectedTable(null);
                }}
                className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
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

      {/* Main Content: Grid + Inspector */}
      <div className="flex flex-1 overflow-hidden">
        {/* Grid Canvas */}
        <div className="flex-1 p-6 overflow-auto">
          {areasLoading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">Cargando...</div>
          ) : !selectedAreaId ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Crea una sala para comenzar
            </div>
          ) : (
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
                  const isSelected =
                    selectedCell?.x === x && selectedCell?.y === y;

                  if (table) {
                    return (
                      <button
                        key={`${x}-${y}`}
                        onClick={() => handleCellClick(x, y)}
                        className={`flex items-center justify-center text-lg font-bold text-white transition-all ${
                          table.shape === "round" ? "rounded-full" : "rounded-lg"
                        } ${
                          table.size_label === "medium" ? "scale-105" : ""
                        } ${
                          isSelected
                            ? "ring-4 ring-yellow-400 ring-offset-2 ring-offset-background"
                            : ""
                        }`}
                        style={{
                          backgroundColor: "hsl(var(--muted-foreground))",
                          width: table.size_label === "medium" ? 76 : 64,
                          height: table.size_label === "medium" ? 76 : 64,
                          margin: "auto",
                        }}
                      >
                        {table.name}
                      </button>
                    );
                  }

                  return (
                    <button
                      key={`${x}-${y}`}
                      onClick={() => handleCellClick(x, y)}
                      className={`border border-dashed border-border/50 rounded-md transition-colors hover:bg-muted/40 flex items-center justify-center ${
                        isSelected
                          ? "border-primary bg-primary/10"
                          : ""
                      }`}
                    >
                      {isSelected && !selectedTable && (
                        <Plus className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Inspector Panel */}
        <div className="w-72 border-l border-border bg-card flex flex-col">
          {activeArea && (
            <div className="bg-muted px-4 py-3 font-bold text-sm uppercase tracking-wide text-foreground border-b border-border">
              {activeArea.name}
            </div>
          )}

          <div className="flex-1 p-4">
            {!selectedCell ? (
              <p className="text-sm text-muted-foreground text-center mt-8">
                Selecciona una ubicación o mesa en la cuadrícula
              </p>
            ) : (
              <div className="space-y-4">
                {selectedTable && (
                  <div className="bg-muted rounded-md px-3 py-2 font-bold text-sm text-foreground flex items-center justify-between">
                    <span>MESA {selectedTable.name}</span>
                    <div className="flex gap-1">
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      <Trash2
                        className="h-3.5 w-3.5 text-destructive cursor-pointer"
                        onClick={handleDelete}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Número / Nombre</Label>
                    <Input
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="Ej: 21"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Forma</Label>
                    <Select value={formShape} onValueChange={(v) => setFormShape(v as "square" | "round")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="square">Cuadrada</SelectItem>
                        <SelectItem value="round">Redonda</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Tamaño</Label>
                    <Select value={formSize} onValueChange={(v) => setFormSize(v as "small" | "medium")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Chica</SelectItem>
                        <SelectItem value="medium">Mediana</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Capacidad (personas)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={formCapacity}
                      onChange={(e) => setFormCapacity(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <Button onClick={handleSave} disabled={upsertTable.isPending}>
                    {upsertTable.isPending ? "Guardando..." : "Guardar"}
                  </Button>
                  {selectedTable && (
                    <Button
                      variant="destructive"
                      onClick={handleDelete}
                      disabled={deleteTable.isPending}
                    >
                      {deleteTable.isPending ? "Eliminando..." : "Eliminar"}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Area Dialog */}
      <Dialog open={newAreaOpen} onOpenChange={setNewAreaOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nueva Sala</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Nombre</Label>
            <Input
              value={newAreaName}
              onChange={(e) => setNewAreaName(e.target.value)}
              placeholder="Ej: Terraza"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button onClick={handleCreateArea} disabled={createArea.isPending}>
              {createArea.isPending ? "Creando..." : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
