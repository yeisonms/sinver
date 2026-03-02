import { useState, useRef, useEffect } from "react";
import { Plus, Pencil, Trash2, Search, Loader2, Upload, X, ImageIcon, ChevronDown, Star } from "lucide-react";
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";
import { useModifierGroups } from "@/hooks/useModifiers";
import { useProductImageUpload } from "@/hooks/useProductImage";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import type { Product } from "@/types/database";
import { ImportProductsModal } from "@/components/admin/ImportProductsModal";

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
  const { data: products = [], isLoading: loadingProducts, refetch: refetchProducts } = useProducts();
  const { data: categories = [], isLoading: loadingCategories } = useCategories();
  const { data: modifierGroups = [] } = useModifierGroups();
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
  const [selectedModifierGroups, setSelectedModifierGroups] = useState<string[]>([]);
  const [modifierPopoverOpen, setModifierPopoverOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, category_id: selectedCategory || "" });
    setImageFile(null);
    setImagePreview(null);
    setSelectedModifierGroups([]);
    setDialogOpen(true);
  };

  const openEdit = async (p: Product) => {
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
    // Load assigned modifier groups
    const { data } = await supabase
      .from("product_modifiers")
      .select("group_id")
      .eq("product_id", p.id);
    setSelectedModifierGroups((data || []).map((r: any) => r.group_id));
    setDialogOpen(true);
  };

  const toggleModifierGroup = (groupId: string) => {
    setSelectedModifierGroups((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
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




  const saveModifierGroups = async (productId: string) => {
    // Delete existing relations
    await supabase.from("product_modifiers").delete().eq("product_id", productId);
    // Insert new ones
    if (selectedModifierGroups.length > 0) {
      const rows = selectedModifierGroups.map((group_id) => ({ product_id: productId, group_id }));
      await supabase.from("product_modifiers").insert(rows);
    }
  };

  const handleSave = async () => {
    try {
      let imageUrl = form.image_url;

      if (imageFile) {
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
        await saveModifierGroups(editing.id);
        toast({ title: "Producto actualizado" });
      } else {
        const newProduct = await createProduct.mutateAsync(payload as Omit<Product, "id">);
        await saveModifierGroups(newProduct.id);
        toast({ title: "Producto creado" });
      }
      setDialogOpen(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const toggleFavorite = async (p: Product) => {
    try {
      await updateProduct.mutateAsync({ id: p.id, is_favorite: !p.is_favorite });
      toast({ title: p.is_favorite ? "Removido de favoritos" : "Agregado a favoritos" });
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
    <div className="flex h-full min-h-[800px] gap-6">
      {/* Left: Category sidebar */}
      <aside className="w-56 shrink-0 bg-card rounded-2xl shadow-premium border border-white/40 overflow-hidden hidden md:flex flex-col">
        <div className="p-4 border-b border-border/50 bg-secondary/20">
          <h2 className="font-semibold text-sm uppercase tracking-widest text-muted-foreground">Categorías</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all ${!selectedCategory
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              }`}
          >
            Todas las categorías
          </button>
          {loadingCategories ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary/40" />
            </div>
          ) : (
            categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all ${selectedCategory === cat.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  }`}
              >
                {cat.name}
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Right: Product list */}
      <div className="flex-1 flex flex-col overflow-hidden bg-card shadow-premium rounded-2xl border border-white/40">
        {/* Mobile category filter */}
        <div className="sm:hidden p-4 border-b border-border/50 bg-secondary/10">
          <Select value={selectedCategory || "all"} onValueChange={(v) => setSelectedCategory(v === "all" ? null : v)}>
            <SelectTrigger className="h-11 rounded-xl bg-background border-border/50 shadow-sm">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border/50 shadow-premium z-50">
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Header & Search Area */}
        <div className="p-6 border-b border-border/50 bg-background/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Productos</h1>
            <p className="text-sm text-muted-foreground mt-1">Gestiona el menú de tu restaurante</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar producto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 pl-9 rounded-xl bg-background border-border/50 shadow-sm transition-all focus:border-primary/50"
              />
            </div>

            <Button
              variant="outline"
              onClick={() => setImportModalOpen(true)}
              className="w-full sm:w-auto rounded-xl shadow-premium gap-2 h-10 border-green-600 text-green-700 hover:bg-green-50"
            >
              <Upload className="h-4 w-4" /> Importar Excel
            </Button>

            <Button onClick={openCreate} className="w-full sm:w-auto rounded-xl shadow-premium gap-2 h-10">
              <Plus className="h-4 w-4" /> Nuevo Producto
            </Button>
          </div>
        </div>

        {/* Table Area */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex-1 h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
                <p className="text-sm font-medium text-muted-foreground">Cargando catálogo...</p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex-1 h-full flex items-center justify-center p-8">
              <div className="text-center max-w-sm flex flex-col items-center gap-2">
                <div className="w-16 h-16 bg-secondary/50 rounded-full flex items-center justify-center mb-2">
                  <Search className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">No se encontraron productos</h3>
                <p className="text-sm text-muted-foreground">{products.length === 0 ? "Aún no has agregado ningún producto al catálogo." : "No hay resultados para la búsqueda actual."}</p>
                {products.length === 0 && (
                  <Button onClick={openCreate} className="mt-4 gap-2 rounded-xl shadow-premium">
                    <Plus className="h-4 w-4" /> Crear primer producto
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <table className="w-full min-w-[600px]">
              <thead className="bg-secondary/30 sticky top-0 z-10 backdrop-blur-sm">
                <tr className="border-b border-border/40 text-left text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                  <th className="px-6 py-4 font-medium">Producto</th>
                  <th className="px-6 py-4 font-medium text-right">Precio</th>
                  <th className="px-6 py-4 font-medium text-right hidden lg:table-cell">Costo</th>
                  <th className="px-6 py-4 font-medium text-center w-24">Estado</th>
                  <th className="px-6 py-4 font-medium w-28 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-secondary/20 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {p.image_url ? (
                          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-border/50">
                            <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-secondary/50 flex items-center justify-center shrink-0 border border-border/30 text-muted-foreground/50">
                            <ImageIcon className="h-5 w-5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground text-sm truncate">{p.name}</div>
                          {p.description && <div className="text-xs text-muted-foreground truncate max-w-xs mt-0.5">{p.description}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="font-semibold text-sm text-foreground">${p.price.toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4 text-right hidden lg:table-cell">
                      <div className="font-medium text-sm text-muted-foreground">{p.cost ? `$${p.cost.toLocaleString()}` : "—"}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${p.is_available ? "bg-green-100/50 text-green-700" : "bg-destructive/10 text-destructive"
                        }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${p.is_available ? "bg-green-500" : "bg-destructive"}`} />
                        {p.is_available ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10" onClick={() => toggleFavorite(p)}>
                          <Star className={`h-4 w-4 ${p.is_favorite ? "fill-amber-500 text-amber-500" : ""}`} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={() => openEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(p.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
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
            {/* Modifier Groups Multi-Select */}
            <div>
              <Label>Grupos Modificadores</Label>
              <Popover open={modifierPopoverOpen} onOpenChange={setModifierPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between mt-1 font-normal" type="button">
                    <span className="text-muted-foreground">
                      {selectedModifierGroups.length === 0
                        ? "Seleccionar grupos..."
                        : `${selectedModifierGroups.length} grupo(s) seleccionado(s)`}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <div className="max-h-48 overflow-y-auto p-2 space-y-1">
                    {modifierGroups.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-2">No hay grupos disponibles</p>
                    ) : (
                      modifierGroups.map((g) => (
                        <label
                          key={g.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm"
                        >
                          <Checkbox
                            checked={selectedModifierGroups.includes(g.id)}
                            onCheckedChange={() => toggleModifierGroup(g.id)}
                          />
                          <span>{g.public_name || g.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              {selectedModifierGroups.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {selectedModifierGroups.map((gId) => {
                    const g = modifierGroups.find((mg) => mg.id === gId);
                    return (
                      <Badge key={gId} variant="secondary" className="gap-1 text-xs">
                        {g?.public_name || g?.name || gId}
                        <button
                          type="button"
                          className="ml-0.5 hover:text-destructive"
                          onClick={() => toggleModifierGroup(gId)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}
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

      {/* Import Modal */}
      <ImportProductsModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSuccess={() => refetchProducts()}
      />
    </div>
  );
}
