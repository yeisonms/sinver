import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfDay, endOfDay, differenceInMinutes } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
  const [startAmount, setStartAmount] = useState("");
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const openCashMutation = useMutation({
    mutationFn: async (amount: number) => {
      const { error } = await supabase.from("cash_registers").insert({
        opened_by: user?.id ?? null,
        start_amount: amount,
        status: "open",
        total_sold: 0,
        total_withdrawn: 0,
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
    openCashMutation.mutate(amount);
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

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
        <h1 className="text-sm font-bold tracking-tight uppercase text-foreground">Arqueos</h1>
        <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white text-xs h-8" onClick={() => setShowOpenDialog(true)}>
          Abrir la caja
        </Button>
      </div>

      {/* Dialog Abrir Caja */}
      <Dialog open={showOpenDialog} onOpenChange={setShowOpenDialog}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Abrir Caja</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="text-sm text-muted-foreground">Monto inicial (base)</label>
            <Input
              type="number"
              placeholder="0"
              value={startAmount}
              onChange={(e) => setStartAmount(e.target.value)}
              min={0}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowOpenDialog(false)}>Cancelar</Button>
            <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white" onClick={handleOpenCash} disabled={openCashMutation.isPending}>
              {openCashMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Abrir"}
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
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={(d) => d && setDateFrom(startOfDay(d))}
                className="p-3 pointer-events-auto"
              />
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
              <Calendar
                mode="single"
                selected={dateTo}
                onSelect={(d) => d && setDateTo(endOfDay(d))}
                className="p-3 pointer-events-auto"
              />
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
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
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
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-8 text-sm">
                    Sin arqueos en este rango.
                  </TableCell>
                </TableRow>
              )}
              {registers.map((r) => {
                const isOpen = r.status === "open";
                return (
                  <TableRow
                    key={r.id}
                    className={cn(
                      "text-xs border-l-4",
                      isOpen ? "border-l-red-500" : "border-l-green-500"
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
                        isOpen
                          ? "bg-red-100 text-red-700 border border-red-300"
                          : "bg-green-100 text-green-700 border border-green-300"
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
  );
}
