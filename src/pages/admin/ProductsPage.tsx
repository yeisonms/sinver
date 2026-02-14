import { useState, useRef } from "react";
import { Plus, Pencil, Trash2, Search, Loader2, Upload, X, ImageIcon } from "lucide-react";
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";
import { useProductImageUpload } from "@/hooks/useProductImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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
  const { data: products = [], isLoading: loadingProducts } = useProducts();
  const { data: categories = [], isLoading: loadingCategories } = useCategories();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const { upload, remove, uploading } = useProductImageUpload();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, category_id: selectedCategory || "" });
    setImageFile(null);
    setImagePreview(null);
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
    setImageFile(null);
    setImagePreview(p.image_url || null);
    setDialogOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setForm({ ...form, image_url: "" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };




  const handleSave = async () => {
    try {
      let imageUrl = form.image_url;

      // Upload new image if selected
      if (imageFile) {
        // Remove old image if replacing
        if (editing?.image_url) {
          await remove(editing.image_url);
        }
        imageUrl = await upload(imageFile);
      }

      const payload = {
        ...form,
        category_id: form.category_id || null,
        description: form.description || null,
        image_url: imageUrl || null,
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

  const filtered = products.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = !selectedCategory || p.category_id === selectedCategory;
    return matchSearch && matchCat;
  });

  const isLoading = loadingProducts || loadingCategories;

  return (
    <div className="flex h-full min-h-0">
      {/* Left: Category sidebar */}
      <aside className="w-48 md:w-52 shrink-0 border-r border-border bg-card overflow-y-auto hidden sm:block">
        <div className="py-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`w-full text-left px-5 py-3 text-sm font-medium transition-colors ${
              !selectedCategory
                ? "text-primary border-l-2 border-primary bg-accent"
                : "text-foreground hover:bg-muted"
            }`}
          >
            Todos
          </button>
          {loadingCategories ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`w-full text-left px-5 py-3 text-sm font-medium transition-colors ${
                  selectedCategory === cat.id
                    ? "text-primary border-l-2 border-primary bg-accent"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                {cat.name}
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Right: Product list */}
      <div className="flex-1 flex flex-col p-4 md:p-5 overflow-auto">
        {/* Mobile category filter */}
        <div className="sm:hidden mb-3">
          <Select value={selectedCategory || "all"} onValueChange={(v) => setSelectedCategory(v === "all" ? null : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-foreground">Productos</h1>
          <Button onClick={openCreate} size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> Nuevo Producto
          </Button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-muted-foreground whitespace-nowrap hidden md:inline">Buscar en todas las categorías:</span>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar producto..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 pl-9" />
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-12 text-center flex-1 flex flex-col items-center justify-center">
            <p className="text-muted-foreground">{products.length === 0 ? "No hay productos aún" : "Sin resultados"}</p>
            {products.length === 0 && (
              <Button onClick={openCreate} variant="outline" className="mt-4 gap-2">
                <Plus className="h-4 w-4" /> Crear primer producto
              </Button>
            )}
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="bg-muted text-left text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="px-4 py-2.5">Producto</th>
                  <th className="px-4 py-2.5 text-right">Precio</th>
                  <th className="px-4 py-2.5 text-right hidden md:table-cell">Costo</th>
                  <th className="px-4 py-2.5 text-center w-16">Disp.</th>
                  <th className="px-4 py-2.5 w-20 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-foreground text-sm">{p.name}</div>
                      {p.description && <div className="text-xs text-muted-foreground truncate max-w-xs">{p.description}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-sm">${p.price.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-sm text-muted-foreground hidden md:table-cell">{p.cost ? `$${p.cost.toLocaleString()}` : "—"}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-block w-2.5 h-2.5 rounded-full ${p.is_available ? "bg-green-500" : "bg-destructive"}`} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex justify-end gap-0.5">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(p.id)}>
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
      </div>

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
                <SelectContent className="bg-popover z-50">
                  {loadingCategories ? (
                    <div className="flex items-center justify-center py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Imagen del producto</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              {imagePreview ? (
                <div className="relative mt-2 w-full h-40 rounded-lg border border-border overflow-hidden bg-muted">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7"
                    onClick={clearImage}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 w-full h-32 rounded-lg border-2 border-dashed border-border bg-muted/50 flex flex-col items-center justify-center gap-2 hover:bg-muted transition-colors cursor-pointer"
                >
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Haz clic para subir una imagen
                  </span>
                </button>
              )}
              {uploading && (
                <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Subiendo imagen...
                </div>
              )}
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
