import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Eye, EyeOff, Loader2, LayoutGrid, Printer } from "lucide-react";
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from "@/hooks/useCategories";
import { usePrinters, useCategoryPrinters } from "@/hooks/usePrinters";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import type { Category } from "@/types/database";

interface CategoryForm {
  name: string;
  sort_order: number;
  is_visible_online: boolean;
  show_in_app: boolean;
  show_in_store: boolean;
  show_in_qr: boolean;
}

const defaultForm: CategoryForm = {
  name: "",
  sort_order: 0,
  is_visible_online: true,
  show_in_app: false,
  show_in_store: true,
  show_in_qr: true,
};

export default function CategoriesPage() {
  const { data: categories = [], isLoading } = useCategories();
  const { data: printers = [], isLoading: printersLoading } = usePrinters();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryForm>(defaultForm);
  const [selectedPrinters, setSelectedPrinters] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: editPrinterIds } = useCategoryPrinters(editing?.id ?? null);

  useEffect(() => {
    if (editPrinterIds) setSelectedPrinters(editPrinterIds);
  }, [editPrinterIds]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...defaultForm, sort_order: (categories.length + 1) * 10 });
    setSelectedPrinters([]);
    setDialogOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setForm({
      name: cat.name,
      sort_order: cat.sort_order,
      is_visible_online: cat.is_visible_online,
      show_in_app: cat.show_in_app,
      show_in_store: cat.show_in_store,
      show_in_qr: cat.show_in_qr,
    });
    setSelectedPrinters([]);
    setDialogOpen(true);
  };

  const togglePrinter = (printerId: string) => {
    setSelectedPrinters((prev) =>
      prev.includes(printerId) ? prev.filter((id) => id !== printerId) : [...prev, printerId]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let categoryId: string;
      if (editing) {
        await updateCategory.mutateAsync({ id: editing.id, ...form });
        categoryId = editing.id;
      } else {
        const created = await createCategory.mutateAsync(form);
        categoryId = created.id;
      }

      // Sync category_printers
      await supabase.from("category_printers").delete().eq("category_id", categoryId);
      if (selectedPrinters.length > 0) {
        const rows = selectedPrinters.map((printer_id) => ({ category_id: categoryId, printer_id }));
        const { error } = await supabase.from("category_printers").insert(rows);
        if (error) throw error;
      }

      toast({ title: editing ? "Categoría actualizada" : "Categoría creada" });
      setDialogOpen(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCategory.mutateAsync(id);
      toast({ title: "Categoría eliminada" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Categorías de Productos</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestiona las categorías de tu menú</p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Nueva Categoría
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : categories.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <LayoutGrid className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">No hay categorías aún</p>
          <Button onClick={openCreate} variant="outline" className="mt-4 gap-2">
            <Plus className="h-4 w-4" /> Crear primera categoría
          </Button>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-x-auto">
          <table className="w-full min-w-[400px]">
            <thead>
              <tr className="bg-muted text-left text-xs text-muted-foreground uppercase tracking-wider">
                <th className="px-4 py-2.5 w-16">#</th>
                <th className="px-4 py-2.5">Nombre</th>
                <th className="px-4 py-2.5 w-32 text-center">Visible Online</th>
                <th className="px-4 py-2.5 w-24 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{cat.sort_order}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{cat.name}</td>
                  <td className="px-4 py-3 text-center">
                    {cat.is_visible_online ? (
                      <Eye className="h-4 w-4 text-primary mx-auto" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground mx-auto" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-0.5">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(cat)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(cat.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Category Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Categoría" : "Nueva Categoría"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Basic Data */}
            <div className="space-y-3">
              <div>
                <Label htmlFor="cat-name">Nombre *</Label>
                <Input
                  id="cat-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej: Bebidas"
                />
              </div>
              <div>
                <Label htmlFor="cat-order">Orden</Label>
                <Input
                  id="cat-order"
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
                />
              </div>
            </div>

            <Separator />

            {/* Printer Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Printer className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-semibold">Enviar pedidos a:</Label>
              </div>
              {printersLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando impresoras...
                </div>
              ) : printers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay impresoras configuradas</p>
              ) : (
                <div className="space-y-2">
                  {printers.map((printer) => (
                    <label
                      key={printer.id}
                      className="flex items-center gap-3 p-2 rounded-md border border-border hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={selectedPrinters.includes(printer.id)}
                        onCheckedChange={() => togglePrinter(printer.id)}
                      />
                      <span className="text-sm font-medium text-foreground">{printer.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Visibility Section */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Visibilidad en plataformas</Label>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="sw-app" className="font-normal">App comensal</Label>
                  <Switch
                    id="sw-app"
                    checked={form.show_in_app}
                    onCheckedChange={(v) => setForm({ ...form, show_in_app: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="sw-store" className="font-normal">Tienda Online</Label>
                  <Switch
                    id="sw-store"
                    checked={form.show_in_store}
                    onCheckedChange={(v) => setForm({ ...form, show_in_store: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="sw-qr" className="font-normal">Carta QR</Label>
                  <Switch
                    id="sw-qr"
                    checked={form.show_in_qr}
                    onCheckedChange={(v) => setForm({ ...form, show_in_qr: v })}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name.trim() || saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editing ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
