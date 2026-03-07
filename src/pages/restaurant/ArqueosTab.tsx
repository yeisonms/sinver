import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfDay, endOfDay, differenceInMinutes } from "date-fns";
import { CalendarIcon, Loader2, Printer, Trash2, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface CashRegister {
  id: string;
  opened_at: string;
  closed_at: string | null;
  opened_by: string | null;
  start_amount: number;
  end_amount: number | null;
  total_sold: number;
  total_withdrawn: number;
  difference: number | null;
  status: string;
}

function formatDuration(openedAt: string, closedAt: string | null): string {
  if (!closedAt) return "—";
  const mins = differenceInMinutes(new Date(closedAt), new Date(openedAt));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

export default function ArqueosTab() {
  const now = new Date();
  const [dateFrom, setDateFrom] = useState<Date>(startOfDay(now));
  const [dateTo, setDateTo] = useState<Date>(endOfDay(now));
  const [showOpenDialog, setShowOpenDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [startAmount, setStartAmount] = useState("");
  const [endAmount, setEndAmount] = useState("");
  const [openDate, setOpenDate] = useState(format(now, "yyyy-MM-dd"));
  const [openTime, setOpenTime] = useState(format(now, "HH:mm:ss"));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const openCashMutation = useMutation({
    mutationFn: async ({ amount, dateTime }: { amount: number; dateTime: string }) => {
      const { error } = await supabase.from("cash_registers").insert({
        opened_by: user?.id ?? null,
        start_amount: amount,
        status: "open",
        total_sold: 0,
        total_withdrawn: 0,
        opened_at: dateTime,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash-registers"] });
      toast.success("Caja abierta correctamente");
      setShowOpenDialog(false);
      setStartAmount("");
    },
    onError: (err: any) => {
      toast.error("Error al abrir caja: " + err.message);
    },
  });

  const handleOpenCash = () => {
    const amount = parseFloat(startAmount) || 0;
    const dateTime = new Date(`${openDate}T${openTime}`).toISOString();
    openCashMutation.mutate({ amount, dateTime });
  };

  const closeCashMutation = useMutation({
    mutationFn: async ({ id, amount, dateTime }: { id: string; amount: number; dateTime: string }) => {
      const register = registers.find((r) => r.id === id);
      if (!register) throw new Error("Arqueo no encontrado");

      const expectedAmount = register.start_amount + register.total_sold - register.total_withdrawn;
      const difference = amount - expectedAmount;

      const { error } = await supabase.from("cash_registers").update({
        end_amount: amount,
        difference: difference,
        status: "closed",
        closed_at: dateTime,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash-registers"] });
      toast.success("Caja cerrada correctamente");
      setShowCloseDialog(false);
      setEndAmount("");
    },
    onError: (err: any) => {
      toast.error("Error al cerrar caja: " + err.message);
    },
  });

  const handleCloseCash = () => {
    if (!selectedId) return;
    const amount = parseFloat(endAmount) || 0;
    const dateTime = new Date(`${openDate}T${openTime}`).toISOString();
    closeCashMutation.mutate({ id: selectedId, amount, dateTime });
  };

  const handleOpenCloseDialog = () => {
    const n = new Date();
    setOpenDate(format(n, "yyyy-MM-dd"));
    setOpenTime(format(n, "HH:mm:ss"));
    setEndAmount("");
    setShowCloseDialog(true);
  };

  const handleOpenDialog = () => {
    const n = new Date();
    setOpenDate(format(n, "yyyy-MM-dd"));
    setOpenTime(format(n, "HH:mm:ss"));
    setStartAmount("");
    setShowOpenDialog(true);
  };

  const { data: registers = [], isLoading } = useQuery({
    queryKey: ["cash-registers", dateFrom.toISOString(), dateTo.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_registers")
        .select("*")
        .gte("opened_at", dateFrom.toISOString())
        .lte("opened_at", dateTo.toISOString())
        .order("opened_at", { ascending: false });
      if (error) throw error;
      return data as CashRegister[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name");
      if (error) throw error;
      return data as { id: string; full_name: string }[];
    },
  });

  const profileMap = useMemo(() => Object.fromEntries(profiles.map((p) => [p.id, p.full_name])), [profiles]);

  const kpis = useMemo(() => {
    const count = registers.length;
    const totalReal = registers.reduce((s, r) => s + (r.end_amount ?? 0), 0);
    const totalDiff = registers.reduce((s, r) => s + (r.difference ?? 0), 0);
    return { count, totalReal, totalDiff };
  }, [registers]);

  const selectedRegister = registers.find((r) => r.id === selectedId);

  return (
    <div className="flex h-full relative">
      <div className={cn(
        "flex-1 flex flex-col min-w-0 overflow-hidden",
        selectedId ? "hidden md:flex" : "flex"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
          <h1 className="text-sm font-bold tracking-tight uppercase text-foreground">Arqueos</h1>
          <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white text-xs h-8" onClick={handleOpenDialog}>
            Abrir la caja
          </Button>
        </div>

        {/* Dialog Nuevo Arqueo */}
        <Dialog open={showOpenDialog} onOpenChange={setShowOpenDialog}>
          <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden">
            <div className="bg-amber-500 px-4 py-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-white">Nuevo Arqueo de Caja</h2>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <label className="text-xs font-semibold sm:font-normal text-muted-foreground w-full sm:w-28 shrink-0">Hora de apertura *</label>
                <div className="flex items-center gap-2 flex-1">
                  <Input type="date" value={openDate} onChange={(e) => setOpenDate(e.target.value)} className="h-9 sm:h-8 text-xs flex-1" />
                  <Input type="time" step="1" value={openTime} onChange={(e) => setOpenTime(e.target.value)} className="h-9 sm:h-8 text-xs flex-1" />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <label className="text-xs font-semibold sm:font-normal text-muted-foreground w-full sm:w-28 shrink-0">Monto Inicial *</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={startAmount}
                  onChange={(e) => setStartAmount(e.target.value)}
                  min={0}
                  className="h-9 sm:h-8 text-xs border-amber-300 focus-visible:ring-amber-400 w-full sm:flex-1"
                />
              </div>
            </div>
            <DialogFooter className="px-4 pb-4 flex flex-col sm:flex-row gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowOpenDialog(false)} className="w-full sm:w-auto order-1 sm:order-none">Cancelar</Button>
              <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white w-full sm:w-auto" onClick={handleOpenCash} disabled={openCashMutation.isPending}>
                {openCashMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Iniciar Arqueo"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Cerrar Arqueo */}
        <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
          <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden">
            <div className="bg-red-500 px-4 py-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-white">Cerrar Arqueo de Caja</h2>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <label className="text-xs font-semibold sm:font-normal text-muted-foreground w-full sm:w-28 shrink-0">Hora de cierre *</label>
                <div className="flex items-center gap-2 flex-1">
                  <Input type="date" value={openDate} onChange={(e) => setOpenDate(e.target.value)} className="h-9 sm:h-8 text-xs flex-1" />
                  <Input type="time" step="1" value={openTime} onChange={(e) => setOpenTime(e.target.value)} className="h-9 sm:h-8 text-xs flex-1" />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <label className="text-xs font-semibold sm:font-normal text-muted-foreground w-full sm:w-28 shrink-0">Efectivo Físico *</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={endAmount}
                  onChange={(e) => setEndAmount(e.target.value)}
                  min={0}
                  className="h-9 sm:h-8 text-xs border-red-300 focus-visible:ring-red-400 w-full sm:flex-1"
                />
              </div>
            </div>
            <DialogFooter className="px-4 pb-4 flex flex-col sm:flex-row sm:justify-end gap-2 sm:gap-0">
              <Button variant="outline" size="sm" onClick={() => setShowCloseDialog(false)} className="w-full sm:w-auto order-1 sm:order-none">Cancelar</Button>
              <Button size="sm" variant="destructive" className="w-full sm:w-auto" onClick={handleCloseCash} disabled={closeCashMutation.isPending}>
                {closeCashMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar Cierre"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Filters */}
        <div className="border-b border-border bg-card px-4 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Desde:</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                  <CalendarIcon className="h-3 w-3" />
                  {format(dateFrom, "dd/MM/yy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={(d) => d && setDateFrom(startOfDay(d))} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <span className="text-xs text-muted-foreground">Hasta:</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                  <CalendarIcon className="h-3 w-3" />
                  {format(dateTo, "dd/MM/yy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={(d) => d && setDateTo(endOfDay(d))} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* KPIs */}
        <div className="flex items-center gap-6 border-b border-border bg-card px-4 py-2">
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground">Arqueos</div>
            <div className="text-sm font-bold text-foreground">{kpis.count}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground">Total Real</div>
            <div className="text-sm font-bold text-foreground">${kpis.totalReal.toLocaleString()}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground">Diferencia</div>
            <div className={cn("text-sm font-bold", kpis.totalDiff >= 0 ? "text-green-600" : "text-red-600")}>
              ${kpis.totalDiff.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="text-[11px]">
                  <TableHead className="pl-4">Número</TableHead>
                  <TableHead>Apertura</TableHead>
                  <TableHead>Cierre</TableHead>
                  <TableHead>Tiempo</TableHead>
                  <TableHead>Cajero/Rep</TableHead>
                  <TableHead className="text-right">Inicial</TableHead>
                  <TableHead className="text-right">Ingresos</TableHead>
                  <TableHead className="text-right">Egresos</TableHead>
                  <TableHead className="text-right">Real</TableHead>
                  <TableHead className="text-right">Diferencia</TableHead>
                  <TableHead className="text-center pr-4">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-8 text-sm">Sin arqueos en este rango.</TableCell>
                  </TableRow>
                )}
                {registers.map((r) => {
                  const isOpen = r.status === "open";
                  return (
                    <TableRow
                      key={r.id}
                      onClick={() => setSelectedId(r.id === selectedId ? null : r.id)}
                      className={cn(
                        "cursor-pointer text-xs border-l-4 transition-colors",
                        isOpen ? "border-l-red-500" : "border-l-green-500",
                        r.id === selectedId ? "bg-amber-100/80 hover:bg-amber-100/80" : "hover:bg-muted/40"
                      )}
                    >
                      <TableCell className="font-mono pl-4">{r.id.slice(0, 8)}</TableCell>
                      <TableCell>{format(new Date(r.opened_at), "dd/MM/yy HH:mm")}</TableCell>
                      <TableCell>{r.closed_at ? format(new Date(r.closed_at), "dd/MM/yy HH:mm") : "—"}</TableCell>
                      <TableCell>{formatDuration(r.opened_at, r.closed_at)}</TableCell>
                      <TableCell>{r.opened_by ? profileMap[r.opened_by] ?? "" : ""}</TableCell>
                      <TableCell className="text-right">${r.start_amount.toLocaleString()}</TableCell>
                      <TableCell className="text-right">${r.total_sold.toLocaleString()}</TableCell>
                      <TableCell className="text-right">${r.total_withdrawn.toLocaleString()}</TableCell>
                      <TableCell className="text-right">${(r.end_amount ?? 0).toLocaleString()}</TableCell>
                      <TableCell className={cn("text-right font-medium", (r.difference ?? 0) >= 0 ? "text-green-600" : "text-red-600")}>
                        ${(r.difference ?? 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center pr-4">
                        <span className={cn(
                          "inline-block text-[10px] font-semibold px-2 py-0.5 rounded",
                          isOpen ? "bg-red-100 text-red-700 border border-red-300" : "bg-green-100 text-green-700 border border-green-300"
                        )}>
                          {isOpen ? "Abierta" : "Cerrada"}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Right: Detail panel */}
      <div className={cn(
        "w-full md:w-80 border-l border-border flex-col shrink-0 bg-card absolute md:static inset-0 z-10 md:z-auto h-full overflow-hidden",
        selectedId ? "flex" : "hidden md:flex"
      )}>
        <div className="flex items-center justify-between px-4 py-2 bg-amber-500">
          <div className="flex items-center gap-2">
            <button className="md:hidden text-white hover:opacity-80 active:opacity-60 transition-opacity" onClick={() => setSelectedId(null)}>
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h2 className="text-sm font-bold uppercase tracking-wide text-white">Arqueo de Caja</h2>
          </div>
          <div className="flex items-center gap-0.5">
            {selectedRegister?.status === "open" && (
              <Button size="sm" variant="destructive" className="h-7 text-xs px-2 mr-2" onClick={handleOpenCloseDialog}>
                Cerrar Caja
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7 text-white hover:bg-amber-600"><Printer className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-white hover:bg-amber-600"><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        </div>

        {selectedRegister ? (
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {/* Info general */}
              <div className="space-y-2">
                {[
                  { label: "Hora de apertura", value: format(new Date(selectedRegister.opened_at), "dd/MM/yy HH:mm:ss") },
                  { label: "Creado Por", value: selectedRegister.opened_by ? profileMap[selectedRegister.opened_by] ?? "" : "" },
                  { label: "Hora de cierre", value: selectedRegister.closed_at ? format(new Date(selectedRegister.closed_at), "dd/MM/yy HH:mm:ss") : "—" },
                  { label: "Cerrado por", value: selectedRegister.opened_by ? profileMap[selectedRegister.opened_by] ?? "" : "" },
                  { label: "Estado", value: selectedRegister.status === "open" ? "Abierto" : "Cerrado" },
                  { label: "Comentario", value: "" },
                ].map((row) => (
                  <div key={row.label} className="flex items-start">
                    <span className="text-xs text-muted-foreground w-28 shrink-0">{row.label}</span>
                    <span className="text-xs font-medium text-foreground">{row.value}</span>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Según Sistema */}
              <div>
                <div className="bg-muted/60 px-3 py-1.5 -mx-4 mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Según Sistema</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Monto Inicial</span>
                    <span className="font-medium text-foreground">${selectedRegister.start_amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Ingresos</span>
                    <span className="font-medium text-foreground">${selectedRegister.total_sold.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs pl-4">
                    <span className="text-muted-foreground">↳ Efectivo</span>
                    <span className="font-medium text-foreground">${selectedRegister.total_sold.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Egreso</span>
                    <span className="font-medium text-foreground">${selectedRegister.total_withdrawn.toLocaleString()}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-foreground">Total</span>
                    <span className="text-foreground">
                      ${(selectedRegister.start_amount + selectedRegister.total_sold - selectedRegister.total_withdrawn).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Según Usuario */}
              <div>
                <div className="bg-muted/60 px-3 py-1.5 -mx-4 mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Según Usuario</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Efectivo</span>
                    <span className="font-medium text-foreground">${(selectedRegister.end_amount ?? 0).toLocaleString()}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-foreground">Total</span>
                    <span className="text-foreground">${(selectedRegister.end_amount ?? 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Diferencia */}
              <div className="flex justify-between text-xs font-bold">
                <span className="text-foreground">Diferencia</span>
                <span className={cn((selectedRegister.difference ?? 0) >= 0 ? "text-green-600" : "text-red-600")}>
                  ${(selectedRegister.difference ?? 0).toLocaleString()}
                </span>
              </div>
            </div>
          </ScrollArea>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-muted-foreground">Selecciona un arqueo</p>
          </div>
        )}
      </div>
    </div>
  );
}
