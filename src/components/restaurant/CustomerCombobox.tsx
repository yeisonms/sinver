import { useState, useEffect, useRef } from "react";
import { Check, ChevronsUpDown, Plus, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useSearchCustomers, useCreateCustomer } from "@/hooks/useCustomers";
import { cn } from "@/lib/utils";
import type { Customer } from "@/types/database";

interface CustomerSelection {
  customer: Customer | null;
  displayName: string;
}

interface Props {
  value: CustomerSelection;
  onChange: (value: CustomerSelection) => void;
}

export function CustomerCombobox({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: results = [] } = useSearchCustomers(search);
  const createCustomer = useCreateCustomer();

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSelect = (customer: Customer) => {
    onChange({ customer, displayName: customer.name });
    setSearch("");
    setOpen(false);
  };

  const handleUseWithoutSaving = () => {
    onChange({ customer: null, displayName: search });
    setOpen(false);
  };

  const handleOpenNewDialog = () => {
    setNewName(search);
    setNewPhone("");
    setNewNotes("");
    setOpen(false);
    setDialogOpen(true);
  };

  const handleSaveNew = async () => {
    try {
      const created = await createCustomer.mutateAsync({
        name: newName,
        phone: newPhone || null,
        notes: newNotes || null,
      });
      onChange({ customer: created, displayName: created.name });
      setDialogOpen(false);
      setSearch("");
    } catch (err) {
      console.error("Error creating customer:", err);
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            {value.displayName || "Seleccionar cliente..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <div className="p-2 border-b border-border">
            <Input
              ref={inputRef}
              placeholder="Buscar por nombre o teléfono..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="max-h-60 overflow-auto p-1">
            {results.length === 0 && search.length >= 1 && (
              <p className="text-sm text-muted-foreground text-center py-3">Sin coincidencias</p>
            )}
            {results.map((c) => (
              <button
                key={c.id}
                onClick={() => handleSelect(c)}
                className={cn(
                  "w-full flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent text-left",
                  value.customer?.id === c.id && "bg-accent"
                )}
              >
                <Check className={cn("h-4 w-4 shrink-0", value.customer?.id === c.id ? "opacity-100" : "opacity-0")} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{c.name}</p>
                  {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                </div>
              </button>
            ))}

            {search.length >= 1 && (
              <div className="border-t border-border mt-1 pt-1 space-y-0.5">
                <button
                  onClick={handleUseWithoutSaving}
                  className="w-full flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent text-left text-muted-foreground"
                >
                  <UserX className="h-4 w-4 shrink-0" />
                  <span>Usar "<span className="font-medium text-foreground">{search}</span>" sin registrar</span>
                </button>
                <button
                  onClick={handleOpenNewDialog}
                  className="w-full flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent text-left text-primary font-medium"
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  <span>Nuevo Cliente: "<span>{search}</span>"</span>
                </button>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input type="tel" inputMode="numeric" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="Ej: 3001234567" />
            </div>
            <div className="space-y-2">
              <Label>Comentario</Label>
              <Textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="Opcional..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveNew} disabled={!newName.trim() || createCustomer.isPending}>
              {createCustomer.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
