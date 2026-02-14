import { useState } from "react";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  useModifierGroups,
  useCreateModifierGroup,
  useUpdateModifierGroup,
  useDeleteModifierGroup,
  useModifierOptions,
  useCreateModifierOption,
  useDeleteModifierOption,
  useAssociatedProducts,
} from "@/hooks/useModifiers";
import type { ModifierGroup } from "@/types/database";

const PRICE_LOGIC_LABELS: Record<string, string> = {
  sum: "Suma",
  max: "Máximo",
  average: "Promedio",
};

export default function ModifiersPage() {
  const { toast } = useToast();
  const { data: groups, isLoading } = useModifierGroups();
  const createGroup = useCreateModifierGroup();
  const updateGroup = useUpdateModifierGroup();
  const deleteGroup = useDeleteModifierGroup();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [groupModal, setGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ModifierGroup | null>(null);
  const [optionModal, setOptionModal] = useState(false);

  // Group form state
  const [gName, setGName] = useState("");
  const [gPublicName, setGPublicName] = useState("");
  const [gPriceLogic, setGPriceLogic] = useState<string>("sum");
  const [gMin, setGMin] = useState("");
  const [gMax, setGMax] = useState("");

  // Option form state
  const [oName, setOName] = useState("");
  const [oPrice, setOPrice] = useState("");

  const selected = groups?.find((g) => g.id === selectedId) || null;
  const { data: options } = useModifierOptions(selectedId);
  const { data: associatedProducts } = useAssociatedProducts(selectedId);
  const createOption = useCreateModifierOption();
  const deleteOption = useDeleteModifierOption();

  const openCreateGroup = () => {
    setEditingGroup(null);
    setGName("");
    setGPublicName("");
    setGPriceLogic("sum");
    setGMin("");
    setGMax("");
    setGroupModal(true);
  };

  const openEditGroup = () => {
    if (!selected) return;
    setEditingGroup(selected);
    setGName(selected.name);
    setGPublicName(selected.public_name || "");
    setGPriceLogic(selected.price_logic);
    setGMin(String(selected.min_selection));
    setGMax(String(selected.max_selection));
    setGroupModal(true);
  };

  const handleSaveGroup = async () => {
    if (!gName.trim() || !gMax.trim()) {
      toast({ title: "Nombre y Cant. máxima son requeridos", variant: "destructive" });
      return;
    }
    const payload = {
      name: gName.trim(),
      public_name: gPublicName.trim() || null,
      price_logic: gPriceLogic as "sum" | "max" | "average",
      min_selection: parseInt(gMin) || 0,
      max_selection: parseInt(gMax),
    };
    try {
      if (editingGroup) {
        await updateGroup.mutateAsync({ id: editingGroup.id, ...payload });
        toast({ title: "Grupo actualizado" });
      } else {
        await createGroup.mutateAsync(payload);
        toast({ title: "Grupo creado" });
      }
      setGroupModal(false);
    } catch {
      toast({ title: "Error al guardar", variant: "destructive" });
    }
  };

  const handleDeleteGroup = async () => {
    if (!selected) return;
    try {
      await deleteGroup.mutateAsync(selected.id);
      setSelectedId(null);
      toast({ title: "Grupo eliminado" });
    } catch {
      toast({ title: "Error al eliminar", variant: "destructive" });
    }
  };

  const handleSaveOption = async () => {
    if (!selectedId || !oName.trim()) return;
    try {
      await createOption.mutateAsync({
        modifier_group_id: selectedId,
        name: oName.trim(),
        price_extra: parseFloat(oPrice) || 0,
        max_quantity: 1,
      });
      setOptionModal(false);
      setOName("");
      setOPrice("");
      toast({ title: "Opción agregada" });
    } catch {
      toast({ title: "Error al agregar opción", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-6rem)] overflow-hidden">
      {/* LEFT - Master list */}
      <div className="flex-1 flex flex-col border-r border-border overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
          <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">
            Grupos Modificadores
          </h2>
          <Button size="sm" onClick={openCreateGroup}>
            <Plus className="h-4 w-4 mr-1" /> Nuevo grupo modificador
          </Button>
        </div>
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead className="text-center">Cant. mínima</TableHead>
                <TableHead className="text-center">Cant. máxima</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups?.map((g) => (
                <TableRow
                  key={g.id}
                  className={`cursor-pointer transition-colors ${
                    selectedId === g.id
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => setSelectedId(g.id)}
                >
                  <TableCell className="font-medium">{g.name}</TableCell>
                  <TableCell className="text-center">{g.min_selection}</TableCell>
                  <TableCell className="text-center">{g.max_selection}</TableCell>
                </TableRow>
              ))}
              {(!groups || groups.length === 0) && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    No hay grupos modificadores
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* RIGHT - Detail panel */}
      <div className="w-[400px] shrink-0 flex flex-col overflow-auto bg-background">
        {!selected ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Selecciona un grupo
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground">
              <h3 className="font-bold uppercase text-sm tracking-wide truncate">
                {selected.name}
              </h3>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/20" onClick={openEditGroup}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/20" onClick={handleDeleteGroup}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Details */}
            <div className="px-4 py-3 border-b border-border space-y-1 text-sm">
              <DetailRow label="Nombre" value={selected.name} />
              <DetailRow label="Nombre público" value={selected.public_name || "—"} />
              <DetailRow label="Lógica de precio" value={PRICE_LOGIC_LABELS[selected.price_logic] || selected.price_logic} />
              <DetailRow label="Cant. mínima" value={String(selected.min_selection)} />
              <DetailRow label="Cant. máxima" value={String(selected.max_selection)} />
            </div>

            {/* Modifier Options */}
            <div>
              <div className="flex items-center justify-between px-4 py-2 bg-primary text-primary-foreground">
                <span className="text-xs font-bold uppercase tracking-wide">Productos Modificadores</span>
                <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/20 h-7 w-7" onClick={() => { setOName(""); setOPrice(""); setOptionModal(true); }}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="divide-y divide-border">
                {options?.map((o) => (
                  <div key={o.id} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span>{o.name}</span>
                    <div className="flex items-center gap-2 text-muted-foreground text-xs">
                      <span>${o.price_extra}</span>
                      <span>{o.max_quantity} max</span>
                      <button
                        className="text-destructive hover:text-destructive/80"
                        onClick={() => deleteOption.mutate({ id: o.id, groupId: selected.id })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                {(!options || options.length === 0) && (
                  <p className="px-4 py-3 text-xs text-muted-foreground">Sin opciones</p>
                )}
              </div>
            </div>

            {/* Associated Products */}
            <div>
              <div className="px-4 py-2 bg-primary text-primary-foreground">
                <span className="text-xs font-bold uppercase tracking-wide">Productos Asociados</span>
              </div>
              <div className="divide-y divide-border">
                {associatedProducts?.map((p) => (
                  <div key={p.id} className="px-4 py-2 text-sm">{p.name}</div>
                ))}
                {(!associatedProducts || associatedProducts.length === 0) && (
                  <p className="px-4 py-3 text-xs text-muted-foreground">Sin productos asociados</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Group Modal */}
      <Dialog open={groupModal} onOpenChange={setGroupModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingGroup ? "Editar grupo" : "Nuevo grupo modificador"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nombre *</Label>
              <Input value={gName} onChange={(e) => setGName(e.target.value)} />
            </div>
            <div>
              <Label>Nombre público</Label>
              <Input value={gPublicName} onChange={(e) => setGPublicName(e.target.value)} />
            </div>
            <div>
              <Label>Lógica de precio final</Label>
              <Select value={gPriceLogic} onValueChange={setGPriceLogic}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sum">Suma</SelectItem>
                  <SelectItem value="max">Máximo</SelectItem>
                  <SelectItem value="average">Promedio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cant. mínima</Label>
                <Input type="number" value={gMin} onChange={(e) => setGMin(e.target.value)} />
              </div>
              <div>
                <Label>Cant. máxima *</Label>
                <Input type="number" value={gMax} onChange={(e) => setGMax(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupModal(false)}>Cancelar</Button>
            <Button onClick={handleSaveGroup} disabled={createGroup.isPending || updateGroup.isPending}>
              {(createGroup.isPending || updateGroup.isPending) && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Option Modal */}
      <Dialog open={optionModal} onOpenChange={setOptionModal}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nueva opción</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nombre *</Label>
              <Input value={oName} onChange={(e) => setOName(e.target.value)} />
            </div>
            <div>
              <Label>Precio extra</Label>
              <Input type="number" value={oPrice} onChange={(e) => setOPrice(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOptionModal(false)}>Cancelar</Button>
            <Button onClick={handleSaveOption} disabled={createOption.isPending}>
              {createOption.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="text-muted-foreground w-28 shrink-0">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
