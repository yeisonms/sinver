import { useState } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { Product } from "@/types/database";

const emptyForm = {
  name: "",
  description: "",
  price: 0,
  cost: 0,
  category_id: "",
  image_url: "",
  is_available: true,
  is_tax_included: false,
};

export default function ProductsPage() {
  const { data: products = [], isLoading } = useProducts();
  const { data: categories = [] } = useCategories();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description || "",
      price: p.price,
      cost: p.cost || 0,
      category_id: p.category_id || "",
      image_url: p.image_url || "",
      is_available: p.is_available,
      is_tax_included: p.is_tax_included,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const payload = {
        ...form,
        category_id: form.category_id || null,
        description: form.description || null,
        image_url: form.image_url || null,
        cost: form.cost || null,
      };
      if (editing) {
        await updateProduct.mutateAsync({ id: editing.id, ...payload });
        toast({ title: "Producto actualizado" });
      } else {
        await createProduct.mutateAsync(payload as Omit<Product, "id">);
        toast({ title: "Producto creado" });
      }
      setDialogOpen(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProduct.mutateAsync(id);
      toast({ title: "Producto eliminado" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name || "Sin categoría";

  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory === "all" || p.category_id === filterCategory;
    return matchSearch && matchCat;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Productos</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestiona los productos de tu menú</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Nuevo Producto
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar producto..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <p className="text-muted-foreground">{products.length === 0 ? "No hay productos aún" : "Sin resultados"}</p>
          {products.length === 0 && (
            <Button onClick={openCreate} variant="outline" className="mt-4 gap-2">
              <Plus className="h-4 w-4" /> Crear primer producto
            </Button>
          )}
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50 text-left text-xs text-muted-foreground uppercase tracking-wider">
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3 text-right">Precio</th>
                <th className="px-4 py-3 text-right">Costo</th>
                <th className="px-4 py-3 text-center">Disponible</th>
                <th className="px-4 py-3 text-center">IVA incl.</th>
                <th className="px-4 py-3 w-24 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{p.name}</div>
                    {p.description && <div className="text-xs text-muted-foreground truncate max-w-xs">{p.description}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className="font-normal">{categoryName(p.category_id)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm">${p.price.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-muted-foreground">{p.cost ? `$${p.cost.toLocaleString()}` : "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block w-2 h-2 rounded-full ${p.is_available ? "bg-primary" : "bg-destructive"}`} />
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-muted-foreground">{p.is_tax_included ? "Sí" : "No"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)} className="text-destructive hover:text-destructive">
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

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Producto" : "Nuevo Producto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nombre *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Hamburguesa Clásica" />
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descripción opcional" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Precio *</Label>
                <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Costo</Label>
                <Input type="number" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <Label>Categoría</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>URL de Imagen</Label>
              <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />
            </div>
            <div className="flex items-center justify-between">
              <Label>Disponible</Label>
              <Switch checked={form.is_available} onCheckedChange={(v) => setForm({ ...form, is_available: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>IVA Incluido</Label>
              <Switch checked={form.is_tax_included} onCheckedChange={(v) => setForm({ ...form, is_tax_included: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name.trim() || form.price <= 0}>
              {editing ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
