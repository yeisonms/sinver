import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay, startOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { CalendarIcon, Loader2, Pencil, FileText, Printer, Trash2, Filter, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Order, OrderItem } from "@/types/database";

type PeriodType = "diario" | "semanal" | "mensual" | "rango";

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function buildDateRange(
  period: PeriodType,
  dailyDay: number,
  dailyMonth: number,
  dailyYear: number,
  customFrom?: Date,
  customTo?: Date
) {
  const now = new Date();
  switch (period) {
    case "diario": {
      const d = new Date(dailyYear, dailyMonth, dailyDay);
      return { from: startOfDay(d), to: endOfDay(d) };
    }
    case "semanal":
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
    case "mensual":
      return { from: startOfMonth(now), to: endOfDay(now) };
    case "rango":
      return {
        from: customFrom ? startOfDay(customFrom) : startOfDay(now),
        to: customTo ? endOfDay(customTo) : endOfDay(now),
      };
  }
}

const typeLabels: Record<string, string> = { mesa: "Mesas", domicilio: "Domicilio", recoger: "Mostrador" };

export default function SalesTab() {
  const isMobile = useIsMobile();
  const now = new Date();
  const [hourFilter, setHourFilter] = useState("hora_cierre");
  const [turnoFilter, setTurnoFilter] = useState("all");
  const [periodType, setPeriodType] = useState<PeriodType>("diario");
  const [dailyDay, setDailyDay] = useState(now.getDate());
  const [dailyMonth, setDailyMonth] = useState(now.getMonth());
  const [dailyYear, setDailyYear] = useState(now.getFullYear());
  const [customFrom, setCustomFrom] = useState<Date>();
  const [customTo, setCustomTo] = useState<Date>();
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [waiterFilter, setWaiterFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { from, to } = buildDateRange(periodType, dailyDay, dailyMonth, dailyYear, customFrom, customTo);

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
    refetchOnMount: "always",
    staleTime: 0,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name");
      if (error) throw error;
      return data as { id: string; full_name: string }[];
    },
  });

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
    if (paymentFilter !== "all") result = result.filter((o) => o.payment_method === paymentFilter);
    return result;
  }, [orders, statusFilter, typeFilter, waiterFilter, paymentFilter]);

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

  const selectedOrder = filtered.find((o) => o.id === selectedOrderId);

  const { data: orderItems = [], isLoading: loadingItems } = useQuery({
    queryKey: ["order-items", selectedOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("*, products:product_id(name)")
        .eq("order_id", selectedOrderId!);
      if (error) throw error;
      return (data ?? []).map((item: any) => ({
        ...item,
        product_name: item.products?.name ?? "Producto",
      })) as OrderItem[];
    },
    enabled: !!selectedOrderId,
  });

  const statusBorderColor = (status: string) => {
    if (["cerrado", "entregado"].includes(status)) return "border-l-green-500";
    if (status === "cancelado") return "border-l-muted-foreground";
    return "border-l-amber-500";
  };

  const renderStatusBadge = (status: string) => {
    if (["cerrado", "entregado"].includes(status))
      return <span className="text-green-600 text-xs font-medium">Cerrada</span>;
    if (status === "cancelado")
      return <span className="text-muted-foreground text-xs font-medium">Cancelada</span>;
    return (
      <span className="inline-block border border-amber-500 text-amber-600 text-[10px] font-semibold px-2 py-0.5 rounded">
        En curso
      </span>
    );
  };

  const statusLabel = (status: string) => {
    if (["cerrado", "entregado"].includes(status)) return "Cerrada";
    if (status === "cancelado") return "Cancelada";
    return "En curso";
  };

  const handleSelectOrder = (orderId: string) => {
    setSelectedOrderId(orderId === selectedOrderId ? null : orderId);
  };

  /* ---- Filters UI (shared between mobile collapsible and desktop inline) ---- */
  const filtersContent = (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={hourFilter} onValueChange={setHourFilter}>
          <SelectTrigger className="w-[120px] h-7 text-xs bg-green-600 text-white border-green-600 hover:bg-green-700">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hora_cierre">Hora Cierre</SelectItem>
            <SelectItem value="hora_inicio">Hora Inicio</SelectItem>
          </SelectContent>
        </Select>
        <Select value={turnoFilter} onValueChange={setTurnoFilter}>
          <SelectTrigger className="w-[100px] h-7 text-xs"><SelectValue placeholder="Turno" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Turno</SelectItem>
            <SelectItem value="manana">Mañana</SelectItem>
            <SelectItem value="tarde">Tarde</SelectItem>
            <SelectItem value="noche">Noche</SelectItem>
          </SelectContent>
        </Select>
        <Select value={periodType} onValueChange={(v) => setPeriodType(v as PeriodType)}>
          <SelectTrigger className="w-[110px] h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="diario">Diario</SelectItem>
            <SelectItem value="semanal">Semanal</SelectItem>
            <SelectItem value="mensual">Mensual</SelectItem>
            <SelectItem value="rango">Rango</SelectItem>
          </SelectContent>
        </Select>
        {periodType === "diario" && (
          <>
            <Input type="number" value={dailyDay} onChange={(e) => setDailyDay(Number(e.target.value))} className="w-14 h-7 text-xs text-center" min={1} max={31} />
            <Select value={String(dailyMonth)} onValueChange={(v) => setDailyMonth(Number(v))}>
              <SelectTrigger className="w-[80px] h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (<SelectItem key={i} value={String(i)}>{m}</SelectItem>))}
              </SelectContent>
            </Select>
            <Input type="number" value={dailyYear} onChange={(e) => setDailyYear(Number(e.target.value))} className="w-[70px] h-7 text-xs text-center" min={2020} max={2030} />
          </>
        )}
        {periodType === "rango" && (
          <>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
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
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
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
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px] h-7 text-xs"><SelectValue placeholder="Estado de Venta" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Estado de Venta</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="cerrada">Cerrada</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[130px] h-7 text-xs"><SelectValue placeholder="Tipo de Venta" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tipo de Venta</SelectItem>
            <SelectItem value="mesa">Mesa</SelectItem>
            <SelectItem value="recoger">Mostrador</SelectItem>
            <SelectItem value="domicilio">Domicilio</SelectItem>
          </SelectContent>
        </Select>
        <Select value={waiterFilter} onValueChange={setWaiterFilter}>
          <SelectTrigger className="w-[140px] h-7 text-xs"><SelectValue placeholder="Cam / Rep" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Cam / Rep</SelectItem>
            {profiles.map((p) => (<SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="w-[130px] h-7 text-xs"><SelectValue placeholder="Medio de pago" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Medio de pago</SelectItem>
            <SelectItem value="efectivo">Efectivo</SelectItem>
            <SelectItem value="tarjeta">Tarjeta</SelectItem>
            <SelectItem value="transferencia">Transferencia</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  /* ---- Detail panel content (shared between desktop sidebar and mobile sheet) ---- */
  const detailContent = selectedOrder ? (
    <>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            {[
              { label: "Hora Inicio", value: format(new Date(selectedOrder.created_at), "dd/MM/yy HH:mm:ss") },
              { label: "Hora de cierre", value: selectedOrder.status === "cerrado" && selectedOrder.closed_at ? format(new Date(selectedOrder.closed_at), "dd/MM/yy HH:mm:ss") : "" },
              { label: "Tipo", value: typeLabels[selectedOrder.type] ?? selectedOrder.type },
              { label: "Estado", value: statusLabel(selectedOrder.status) },
              { label: "Mesa", value: selectedOrder.table_id ? tableMap[selectedOrder.table_id] ?? "" : "" },
              { label: "Personas", value: String(selectedOrder.diner_count ?? 1) },
              { label: "Mesero", value: selectedOrder.waiter_id ? profileMap[selectedOrder.waiter_id] ?? "" : "" },
            ].map((row) => (
              <div key={row.label} className="flex items-start">
                <span className="text-xs text-muted-foreground w-24 shrink-0">{row.label}</span>
                <span className="text-xs font-medium text-foreground">{row.value}</span>
              </div>
            ))}
          </div>
          <Separator />
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground mb-3">Adiciones</h3>
            {loadingItems ? (
              <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
            ) : orderItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin productos.</p>
            ) : (
              <div className="space-y-2">
                {orderItems.map((item, i) => (
                  <div key={item.id ?? i} className="flex items-start justify-between gap-2 text-xs">
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-4 text-right shrink-0">{item.quantity}</span>
                      <span className="text-foreground font-medium">{item.product_name}</span>
                    </div>
                    <span className="text-foreground font-medium shrink-0">${(item.quantity * item.unit_price).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
      <div className="border-t border-border px-4 py-3 flex justify-between items-center bg-muted/30">
        <span className="text-xs text-muted-foreground">Total:</span>
        <span className="text-base font-bold text-foreground">${selectedOrder.total_amount.toLocaleString()}</span>
      </div>
    </>
  ) : (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-xs text-muted-foreground">Selecciona una venta</p>
    </div>
  );

  /* ---- KPIs row ---- */
  const kpisRow = (
    <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
      <div className="text-[11px] text-muted-foreground leading-tight">
        <div>Del {format(from, "dd/MM/yy HH:mm")} hs al {format(to, "dd/MM/yy HH:mm")} hs</div>
        <div>{filtered.length} registros</div>
      </div>
      <div className="flex items-center gap-3 md:gap-6 overflow-x-auto">
        {[
          { label: "Ventas", value: String(kpis.count) },
          { label: "Prom/venta", value: `$${Math.round(kpis.avgSale).toLocaleString()}` },
          { label: "Personas", value: String(kpis.people) },
          { label: "Prom/persona", value: `$${Math.round(kpis.avgPerson).toLocaleString()}` },
          { label: "Total", value: `$${kpis.total.toLocaleString()}` },
        ].map((k) => (
          <div key={k.label} className="text-right shrink-0">
            <div className="text-[10px] text-muted-foreground">{k.label}</div>
            <div className="text-sm font-bold text-foreground">{k.value}</div>
          </div>
        ))}
      </div>
    </div>
  );

  /* ---- Sales table (mobile: simplified, desktop: full) ---- */
  const salesTable = (
    <div className="flex-1 overflow-auto">
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="text-[11px]">
              <TableHead className="w-20 pl-4">ID</TableHead>
              <TableHead className="hidden md:table-cell w-36">Hora Inicio</TableHead>
              <TableHead className="w-36">Hora cierre</TableHead>
              <TableHead className="w-20">Estado</TableHead>
              <TableHead className="hidden md:table-cell w-14">Mesa</TableHead>
              <TableHead className="hidden md:table-cell">Cam / Rep</TableHead>
              <TableHead className="hidden md:table-cell">Cliente</TableHead>
              <TableHead className="hidden md:table-cell w-24">Facturación</TableHead>
              <TableHead className="text-right w-24 pr-4">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8 text-sm">
                  Sin ventas en este rango.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((o) => (
              <TableRow
                key={o.id}
                onClick={() => handleSelectOrder(o.id)}
                className={cn(
                  "cursor-pointer border-l-4 transition-colors text-xs",
                  statusBorderColor(o.status),
                  o.id === selectedOrderId ? "bg-amber-100/80 hover:bg-amber-100/80" : "hover:bg-muted/40"
                )}
              >
                <TableCell className="font-mono pl-4">{o.order_number}</TableCell>
                <TableCell className="hidden md:table-cell">{format(new Date(o.created_at), "dd/MM/yy HH:mm:ss")}</TableCell>
                <TableCell>{o.status === "cerrado" && o.closed_at ? format(new Date(o.closed_at), "dd/MM/yy HH:mm:ss") : format(new Date(o.created_at), "dd/MM/yy HH:mm")}</TableCell>
                <TableCell>{renderStatusBadge(o.status)}</TableCell>
                <TableCell className="hidden md:table-cell text-center">{o.table_id ? tableMap[o.table_id] ?? "" : ""}</TableCell>
                <TableCell className="hidden md:table-cell">{o.waiter_id ? profileMap[o.waiter_id] ?? "" : ""}</TableCell>
                <TableCell className="hidden md:table-cell">{o.client_name ?? ""}</TableCell>
                <TableCell className="hidden md:table-cell">
                  <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground border-muted-foreground/30">
                    No facturado
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium pr-4">${o.total_amount.toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );

  return (
    <div className="flex h-full">
      {/* Main list column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
          <h1 className="text-sm font-bold tracking-tight uppercase text-foreground">Ventas</h1>
          <div className="flex items-center gap-2">
            {/* Mobile filter toggle */}
            {isMobile && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={() => setFiltersOpen(!filtersOpen)}
              >
                <Filter className="h-3.5 w-3.5" />
                Filtros
              </Button>
            )}
            <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white text-xs h-8">
              Abrir la caja
            </Button>
          </div>
        </div>

        {/* Filters: collapsible on mobile, always visible on desktop */}
        {isMobile ? (
          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
            <CollapsibleContent className="border-b border-border bg-card px-4 py-2">
              {filtersContent}
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <div className="border-b border-border bg-card px-4 py-2">
            {filtersContent}
          </div>
        )}

        {/* KPIs */}
        {kpisRow}

        {/* Sales table */}
        {salesTable}
      </div>

      {/* Desktop detail panel */}
      <div className="hidden md:flex w-72 border-l border-border flex-col shrink-0 bg-card">
        <div className="flex items-center justify-between px-4 py-2 bg-amber-500">
          <h2 className="text-sm font-bold uppercase tracking-wide text-white">Venta</h2>
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-white hover:bg-amber-600"><FileText className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-white hover:bg-amber-600"><Pencil className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-white hover:bg-amber-600"><Printer className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-white hover:bg-amber-600"><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
        {detailContent}
      </div>

      {/* Mobile detail sheet */}
      {isMobile && (
        <Sheet open={!!selectedOrder && isMobile} onOpenChange={(open) => { if (!open) setSelectedOrderId(null); }}>
          <SheetContent side="bottom" className="h-[90vh] flex flex-col p-0">
            <div className="flex items-center justify-between px-4 py-2 bg-amber-500">
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-amber-600 gap-1 h-7 px-2 text-xs"
                onClick={() => setSelectedOrderId(null)}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Volver
              </Button>
              <h2 className="text-sm font-bold uppercase tracking-wide text-white">Venta #{selectedOrder?.order_number}</h2>
              <div className="flex items-center gap-0.5">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-white hover:bg-amber-600"><Printer className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
            {detailContent}
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
