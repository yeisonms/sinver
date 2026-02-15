import { useState } from "react";
import { Search, Plus, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOrders } from "@/hooks/useOrders";
import { NewOrderSheet } from "@/components/restaurant/NewOrderSheet";
import type { Order } from "@/types/database";
import { format } from "date-fns";

const typeLabels: Record<string, string> = {
  mesa: "Mesa",
  domicilio: "Domicilio",
  recoger: "Recoger",
};

function OrderTable({ orders, loading }: { orders: Order[]; loading: boolean }) {
  if (loading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!orders.length) return <p className="text-sm text-muted-foreground py-3 px-4">Sin órdenes.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-20">ID</TableHead>
          <TableHead className="w-24">Hora</TableHead>
          <TableHead>Origen</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead className="text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((o) => (
          <TableRow key={o.id}>
            <TableCell className="font-mono text-xs">#{o.order_number}</TableCell>
            <TableCell className="text-xs">{format(new Date(o.created_at), "HH:mm")}</TableCell>
            <TableCell className="text-xs">{typeLabels[o.type] ?? o.type}</TableCell>
            <TableCell className="text-sm">{o.client_name ?? "—"}</TableCell>
            <TableCell className="text-right font-medium">${o.total_amount.toLocaleString()}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function CounterPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(true);
  const [activeOpen, setActiveOpen] = useState(true);

  const { data: pendingOnline = [], isLoading: loadPending } = useOrders(["pendiente_online"]);
  const { data: allActive = [], isLoading: loadActive } = useOrders(["pendiente", "en_preparacion"]);

  // Filter out "mesa" orders — they are managed in the tables view
  const active = allActive.filter((o) => o.type !== "mesa");

  const filteredPending = searchTerm
    ? pendingOnline.filter((o) => o.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) || String(o.order_number).includes(searchTerm))
    : pendingOnline;

  const filteredActive = searchTerm
    ? active.filter((o) => o.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) || String(o.order_number).includes(searchTerm))
    : active;

  return (
    <div className="flex flex-col h-full">
      {/* Search bar + new order */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por etiqueta/ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setSheetOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Nuevo Pedido
        </Button>
      </div>

      {/* Order sections */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        <Collapsible open={pendingOpen} onOpenChange={setPendingOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full text-left font-semibold text-sm py-2">
            {pendingOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span className="uppercase tracking-wide text-amber-600">Pendiente</span>
            <span className="text-xs font-normal text-muted-foreground">({filteredPending.length})</span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <OrderTable orders={filteredPending} loading={loadPending} />
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible open={activeOpen} onOpenChange={setActiveOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full text-left font-semibold text-sm py-2">
            {activeOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span className="uppercase tracking-wide text-primary">En Curso</span>
            <span className="text-xs font-normal text-muted-foreground">({filteredActive.length})</span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <OrderTable orders={filteredActive} loading={loadActive} />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <NewOrderSheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}
