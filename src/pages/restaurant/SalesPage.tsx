import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay, subDays, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Pencil, Printer, Trash2, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { Order, OrderItem } from "@/types/database";

type DateRange = "today" | "yesterday" | "this_month" | "custom";

function getDateRange(range: DateRange, customFrom?: Date, customTo?: Date) {
  const now = new Date();
  switch (range) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "yesterday":
      return { from: startOfDay(subDays(now, 1)), to: endOfDay(subDays(now, 1)) };
    case "this_month":
      return { from: startOfMonth(now), to: endOfDay(now) };
    case "custom":
      return {
        from: customFrom ? startOfDay(customFrom) : startOfDay(now),
        to: customTo ? endOfDay(customTo) : endOfDay(now),
      };
  }
}

export default function SalesPage() {
  const [dateRange, setDateRange] = useState<DateRange>("today");
  const [customFrom, setCustomFrom] = useState<Date>();
  const [customTo, setCustomTo] = useState<Date>();
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [waiterFilter, setWaiterFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const { from, to } = getDateRange(dateRange, customFrom, customTo);

  // Fetch orders with joins
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["sales-orders", from.toISOString(), to.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Order[];
    },
  });

  // Fetch profiles for waiter names
  const { data: profiles = [] } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name");
      if (error) throw error;
      return data as { id: string; full_name: string }[];
    },
  });

  // Fetch tables for table names
  const { data: tables = [] } = useQuery({
    queryKey: ["all-tables-sales"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tables").select("id, name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const profileMap = useMemo(() => Object.fromEntries(profiles.map((p) => [p.id, p.full_name])), [profiles]);
  const tableMap = useMemo(() => Object.fromEntries(tables.map((t) => [t.id, t.name])), [tables]);

  // Apply filters
  const filtered = useMemo(() => {
    let result = orders;
    if (statusFilter !== "all") {
      const map: Record<string, string[]> = {
        pendiente: ["pendiente", "pendiente_online", "en_preparacion"],
        cerrada: ["cerrado"],
        cancelada: ["cancelado"],
      };
      result = result.filter((o) => map[statusFilter]?.includes(o.status));
    }
    if (typeFilter !== "all") result = result.filter((o) => o.type === typeFilter);
    if (waiterFilter !== "all") result = result.filter((o) => o.waiter_id === waiterFilter);
    return result;
  }, [orders, statusFilter, typeFilter, waiterFilter]);

  // KPIs
  const kpis = useMemo(() => {
    const count = filtered.length;
    const totalMoney = filtered.reduce((s, o) => s + o.total_amount, 0);
    const totalPeople = filtered.reduce((s, o) => s + (o.diner_count ?? 0), 0);
    return {
      count,
      avgSale: count ? totalMoney / count : 0,
      people: totalPeople,
      avgPerson: totalPeople ? totalMoney / totalPeople : 0,
      total: totalMoney,
    };
  }, [filtered]);

  // Selected order detail
  const selectedOrder = filtered.find((o) => o.id === selectedOrderId);

  const { data: orderItems = [], isLoading: loadingItems } = useQuery({
    queryKey: ["order-items", selectedOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", selectedOrderId!);
      if (error) throw error;
      return data as OrderItem[];
    },
    enabled: !!selectedOrderId,
  });

  const statusColor = (status: string) => {
    if (["cerrado", "entregado"].includes(status)) return "border-l-green-500";
    if (status === "cancelado") return "border-l-muted-foreground";
    return "border-l-red-500";
  };

  const statusBadge = (status: string) => {
    if (["cerrado", "entregado"].includes(status))
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-[10px]">Cerrada</Badge>;
    if (status === "cancelado")
      return <Badge variant="secondary" className="text-[10px]">Cancelada</Badge>;
    return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-[10px]">En curso</Badge>;
  };

  const typeLabels: Record<string, string> = { mesa: "Mesa", domicilio: "Domicilio", recoger: "Mostrador" };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <h1 className="text-lg font-bold tracking-tight uppercase text-foreground">Ventas</h1>
        <Button className="bg-amber-500 hover:bg-amber-600 text-white">Abrir la caja</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-border bg-card">
        <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
          <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoy</SelectItem>
            <SelectItem value="yesterday">Ayer</SelectItem>
            <SelectItem value="this_month">Este mes</SelectItem>
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>

        {dateRange === "custom" && (
          <>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                  <CalendarIcon className="h-3 w-3" />
                  {customFrom ? format(customFrom, "dd/MM/yy") : "Desde"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                  <CalendarIcon className="h-3 w-3" />
                  {customTo ? format(customTo, "dd/MM/yy") : "Hasta"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customTo} onSelect={setCustomTo} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </>
        )}

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="cerrada">Cerrada</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="mesa">Mesa</SelectItem>
            <SelectItem value="recoger">Mostrador</SelectItem>
            <SelectItem value="domicilio">Domicilio</SelectItem>
          </SelectContent>
        </Select>

        <Select value={waiterFilter} onValueChange={setWaiterFilter}>
          <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue placeholder="Mesero" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {profiles.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Medio de pago" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="efectivo">Efectivo</SelectItem>
            <SelectItem value="tarjeta">Tarjeta</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-3 px-4 py-3 border-b border-border bg-muted/30">
        {[
          { label: "Ventas", value: kpis.count.toString() },
          { label: "Promedio / venta", value: `$${Math.round(kpis.avgSale).toLocaleString()}` },
          { label: "Personas", value: kpis.people.toString() },
          { label: "Promedio / persona", value: `$${Math.round(kpis.avgPerson).toLocaleString()}` },
          { label: "Total", value: `$${kpis.total.toLocaleString()}` },
        ].map((k) => (
          <Card key={k.label} className="shadow-none border-border">
            <CardContent className="py-3 px-4">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{k.label}</p>
              <p className="text-xl font-bold text-foreground">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main content: table + detail panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Orders table */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">ID</TableHead>
                  <TableHead className="w-20">Inicio</TableHead>
                  <TableHead className="w-20">Cierre</TableHead>
                  <TableHead className="w-20">Estado</TableHead>
                  <TableHead className="w-20">Mesa</TableHead>
                  <TableHead>Cam/Rep</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="w-24">Facturación</TableHead>
                  <TableHead className="text-right w-24">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Sin ventas en este rango.</TableCell></TableRow>
                )}
                {filtered.map((o) => (
                  <TableRow
                    key={o.id}
                    onClick={() => setSelectedOrderId(o.id === selectedOrderId ? null : o.id)}
                    className={cn(
                      "cursor-pointer border-l-4 transition-colors",
                      statusColor(o.status),
                      o.id === selectedOrderId ? "bg-amber-50" : "hover:bg-muted/50"
                    )}
                  >
                    <TableCell className="font-mono text-xs">#{o.order_number}</TableCell>
                    <TableCell className="text-xs">{format(new Date(o.created_at), "HH:mm")}</TableCell>
                    <TableCell className="text-xs">{o.status === "cerrado" ? "—" : ""}</TableCell>
                    <TableCell>{statusBadge(o.status)}</TableCell>
                    <TableCell className="text-xs">{o.table_id ? tableMap[o.table_id] ?? "—" : "—"}</TableCell>
                    <TableCell className="text-xs">{o.waiter_id ? profileMap[o.waiter_id] ?? "—" : "—"}</TableCell>
                    <TableCell className="text-sm">{o.client_name ?? "—"}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-[10px]">—</Badge></TableCell>
                    <TableCell className="text-right font-medium">${o.total_amount.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Detail panel */}
        {selectedOrder && (
          <div className="w-80 border-l border-border bg-card flex flex-col shrink-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">Venta</h2>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7"><Printer className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedOrderId(null)}><X className="h-3.5 w-3.5" /></Button>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-4 space-y-3">
                {/* General info */}
                <div className="space-y-2 text-sm">
                  {[
                    { label: "Hora Inicio", value: format(new Date(selectedOrder.created_at), "HH:mm - dd/MM/yy", { locale: es }) },
                    { label: "Tipo", value: typeLabels[selectedOrder.type] ?? selectedOrder.type },
                    { label: "Estado", value: selectedOrder.status },
                    { label: "Mesa", value: selectedOrder.table_id ? tableMap[selectedOrder.table_id] ?? "—" : "—" },
                    { label: "Personas", value: String(selectedOrder.diner_count ?? 1) },
                    { label: "Mesero", value: selectedOrder.waiter_id ? profileMap[selectedOrder.waiter_id] ?? "—" : "—" },
                    { label: "Cliente", value: selectedOrder.client_name ?? "—" },
                    { label: "Notas", value: selectedOrder.general_notes ?? "—" },
                  ].map((row) => (
                    <div key={row.label} className="flex justify-between">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="font-medium text-foreground">{row.value}</span>
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Items */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Adiciones</h3>
                  {loadingItems ? (
                    <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                  ) : orderItems.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sin productos.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {orderItems.map((item, i) => (
                        <div key={item.id ?? i} className="flex items-center justify-between text-sm">
                          <span>
                            <span className="font-medium text-foreground">{item.quantity}x</span>{" "}
                            <span className="text-foreground">{item.product_name}</span>
                          </span>
                          <span className="font-medium text-foreground">${(item.quantity * item.unit_price).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>

            {/* Footer total */}
            <div className="border-t border-border px-4 py-3 flex justify-between items-center">
              <span className="text-sm font-bold uppercase text-muted-foreground">Total</span>
              <span className="text-xl font-bold text-foreground">${selectedOrder.total_amount.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
