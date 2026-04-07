import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Minus, Plus, X, Receipt, ShoppingCart, ArrowLeft, RotateCcw, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import { useAreas, useTablesByArea } from "@/hooks/useTables";
import { useAuth } from "@/contexts/AuthContext";
import { useOpenTable } from "@/hooks/useOpenTable";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRestaurantInfo } from "@/hooks/useRestaurantInfo";
import { CheckoutDialog } from "@/components/restaurant/CheckoutDialog";
import { MoveTableDialog } from "@/components/restaurant/MoveTableDialog";
import type { Table } from "@/types/database";
import type { CartItem } from "@/components/restaurant/NewOrderSheet";
import { useFavoriteProducts } from "@/hooks/useOrders";
import { useCategories } from "@/hooks/useCategories";
import { printComanda } from "@/lib/printService";
import { OrderDetailPanel } from "@/components/restaurant/OrderDetailPanel";
import { Sheet, SheetContent } from "@/components/ui/sheet";

const GRID_ROWS = 8;
const GRID_COLS = 10;

// ──────────────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────────────
export default function TablesMapPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, role } = useAuth();
  const isMobile = useIsMobile();
  const { info: restaurantInfo } = useRestaurantInfo();
  const tipRate = restaurantInfo?.default_tip_percentage ?? 0;
  const canCheckout = role === "admin" || role === "cajero";

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: areas = [], isLoading: areasLoading } = useAreas();
  const [activeAreaId, setActiveAreaId] = useState<string | null>(null);
  const selectedAreaId = activeAreaId || (areas.length > 0 ? areas[0].id : null);
  const { data: tables = [] } = useTablesByArea(selectedAreaId);

  // Fetch waiter names for occupied tables
  const waiterIds = tables
    .filter((t) => t.status === "ocupada" && t.current_waiter_id)
    .map((t) => t.current_waiter_id!);
  const { data: waiterProfiles = [] } = useQuery({
    queryKey: ["waiter-profiles", waiterIds],
    queryFn: async () => {
      if (waiterIds.length === 0) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", waiterIds);
      if (error) throw error;
      return data as { id: string; full_name: string | null }[];
    },
    enabled: waiterIds.length > 0,
  });
  const waiterNameMap = Object.fromEntries(
    waiterProfiles.map((p) => [p.id, p.full_name ?? ""])
  );

  const openTable = useOpenTable();

  // Dialog/Drawer state for opening a free table
  const [dialogTable, setDialogTable] = useState<Table | null>(null);
  const [dinerCount, setDinerCount] = useState(1);
  const [comment, setComment] = useState("");

  // Mobile: selected occupied table for split-panel
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [moveTableOpen, setMoveTableOpen] = useState(false);

  // Checkout state
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutOrderId, setCheckoutOrderId] = useState<string | null>(null);
  const [checkoutOrderNumber, setCheckoutOrderNumber] = useState<number | null>(null);
  const [checkoutTable, setCheckoutTable] = useState<Table | null>(null);
  const [checkoutConsumedTotal, setCheckoutConsumedTotal] = useState(0);
  const [checkoutOrderOverride, setCheckoutOrderOverride] = useState<any>(null);
  const [closing, setClosing] = useState(false);

  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  const handleSplitSuccess = async (newOrderId: string) => {
    try {
      const { data: newOrderData, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", newOrderId)
        .single();
      if (error) throw error;
      if (newOrderData) {
        setCheckoutOrderId(newOrderData.id);
        setCheckoutOrderNumber(newOrderData.order_number);
        setCheckoutTable(selectedTable);
        setCheckoutConsumedTotal(newOrderData.total_amount || 0);
        setCheckoutOrderOverride(newOrderData);
        setCheckoutOpen(true);
      }
    } catch (err) {
      console.error("Error fetching split order for checkout:", err);
      toast.error("Cuenta dividida, pero no se pudo abrir el cobro automáticamente.");
    }
  };

  const tableIds = tables.map(t => t.id);
  const { data: allActiveOrders = [] } = useQuery({
    queryKey: ["active-orders", tableIds],
    queryFn: async () => {
      if (tableIds.length === 0) return [];
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .in("table_id", tableIds)
        .neq("status", "cerrado")
        .neq("status", "cancelado")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: tableIds.length > 0,
  });

  const activeOrdersForSelectedTable = selectedTable
    ? allActiveOrders.filter(o => o.table_id === selectedTable.id)
    : [];

  const selectedOrder = activeOrderId
    ? allActiveOrders.find(o => o.id === activeOrderId)
    : null;

  const tableAt = (x: number, y: number) =>
    tables.find((t) => t.x_position === x && t.y_position === y);

  const handleTableClick = (table: Table) => {
    setSelectedTable(table);
    setActiveOrderId(null); // Reset detail view to show Dashboard
  };

  const handleOpenTable = async () => {
    if (!dialogTable || !user) return;
    try {
      const order = await openTable.mutateAsync({
        tableId: dialogTable.id,
        areaId: dialogTable.area_id!,
        waiterId: user.id,
        dinerCount: dinerCount,
        comment: comment || null,
      });
      toast.success("Mesa abierta");
      setDialogTable(null);
      setDialogTable(null);
      navigate(`/restaurant/tables/${order.id}/take-order`);
    } catch {
      toast.error("Error al abrir mesa");
    }
  };

  const handleCheckout = async (data: { tipAmount: number; paymentMethod: string; grandTotal: number }) => {
    const targetOrderId = checkoutOrderOverride?.id || checkoutOrderId;
    if (!targetOrderId || !checkoutTable) return;
    setClosing(true);
    try {
      // Get existing items total
      const { data: orderItems } = await supabase
        .from("order_items")
        .select("quantity, unit_price")
        .eq("order_id", targetOrderId)
        .neq("status", "cancelado");
      const consumedTotal = (orderItems ?? []).reduce((s, i) => s + i.unit_price * i.quantity, 0);

      const { data: openRegisters } = await supabase
        .from("cash_registers")
        .select("id")
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(1);
      const openRegisterId = openRegisters?.[0]?.id ?? null;

      const { error: payErr } = await supabase.from("payments").insert({
        order_id: targetOrderId,
        cash_register_id: openRegisterId,
        amount: data.grandTotal,
        method: data.paymentMethod,
      });
      if (payErr) throw payErr;

      const { error: orderErr } = await supabase
        .from("orders")
        .update({
          status: "cerrado",
          total_amount: consumedTotal,
          tip_amount: data.tipAmount,
          closed_at: new Date().toISOString(),
          payment_method: data.paymentMethod,
        })
        .eq("id", targetOrderId);
      if (orderErr) throw orderErr;

      if (checkoutTable.id) {
        const { count: remainingCount } = await supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("table_id", checkoutTable.id)
          .neq("status", "cerrado")
          .neq("status", "cancelado");

        if (remainingCount === 0) {
          await supabase
            .from("tables")
            .update({ status: "libre", current_order_id: null, current_waiter_id: null, printed_control: false })
            .eq("id", checkoutTable.id);
        }
      }

      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["active-orders"] });
      qc.invalidateQueries({ queryKey: ["tables"] });
      qc.invalidateQueries({ queryKey: ["sales-orders"] });
      toast.success("Mesa cerrada y cobro registrado");
      setCheckoutOpen(false);

      if (targetOrderId === activeOrderId) {
        setActiveOrderId(null);
      }
      setCheckoutOrderOverride(null);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error(err?.message || "Error al cerrar mesa");
    } finally {
      setClosing(false);
    }
  };

  // Shared form for opening a table
  const openTableForm = (
    <div className="space-y-5 px-1">
      <div>
        <Label className="text-base font-medium">Personas</Label>
        <div className="flex items-center gap-4 mt-2">
          <Button variant="outline" size="icon" className="h-12 w-12 rounded-xl text-lg" onClick={() => setDinerCount(Math.max(1, dinerCount - 1))}>
            <Minus className="h-5 w-5" />
          </Button>
          <span className="text-2xl font-bold w-10 text-center">{dinerCount}</span>
          <Button variant="outline" size="icon" className="h-12 w-12 rounded-xl text-lg" onClick={() => setDinerCount(dinerCount + 1)}>
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </div>
      <div className="border-t border-border pt-4">
        <Label className="text-base font-medium">Camarero</Label>
        <p className="text-sm text-muted-foreground mt-1">{profile?.full_name ?? user?.email ?? "—"}</p>
      </div>
      <div className="border-t border-border pt-4">
        <Label className="text-base font-medium">Comentario</Label>
        <Textarea placeholder="Notas opcionales..." value={comment} onChange={(e) => setComment(e.target.value)} rows={2} className="mt-2" />
      </div>
    </div>
  );

  const openTableButton = (
    <Button onClick={handleOpenTable} disabled={openTable.isPending} className="w-full h-12 text-base font-semibold">
      {openTable.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
      Abrir nueva cuenta
    </Button>
  );

  // ── TableDashboard component ──
  const renderTableDashboard = () => (
    <div className="flex-1 flex flex-col pt-4 overflow-y-auto">
      <div className="px-6 pb-4">
        <Button
          className="w-full h-12 text-base font-bold text-white shadow-md bg-green-500 hover:bg-green-600"
          onClick={() => {
            if (selectedTable) {
              setDialogTable(selectedTable);
              setDinerCount(1);
              setComment("");
            }
          }}
        >
          <Plus className="h-5 w-5 mr-2" />
          Abrir Nueva Cuenta
        </Button>
      </div>

      <div className="flex-1 px-4 space-y-3 pb-8">
        <Label className="text-sm text-muted-foreground px-2 font-medium">Cuentas Activas ({activeOrdersForSelectedTable.length})</Label>

        {activeOrdersForSelectedTable.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground bg-accent/30 rounded-2xl border border-dashed mx-2 mt-4">
            <ShoppingCart className="h-10 w-10 mb-3 opacity-20" />
            <p className="text-sm font-medium">Mesa vacía</p>
            <p className="text-xs mt-1">Acá aparecerán los pedidos de la mesa.</p>
          </div>
        ) : (
          activeOrdersForSelectedTable.map(order => (
            <button
              key={order.id}
              onClick={() => setActiveOrderId(order.id)}
              className="w-full text-left bg-card hover:bg-accent border shadow-sm p-4 rounded-xl flex items-center justify-between transition-all"
            >
              <div>
                <p className="font-bold text-base flex items-center gap-2">
                  <span>Venta #{order.order_number}</span>
                  {order.client_name && (
                    <span className="text-xs font-normal text-muted-foreground bg-accent px-2 py-0.5 rounded-full">
                      {order.client_name}
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground font-medium">
                  {order.waiter_id && waiterNameMap[order.waiter_id] && (
                    <span>🧑‍🍳 {waiterNameMap[order.waiter_id]}</span>
                  )}
                  {order.diner_count && (
                    <span>👤 x{order.diner_count}</span>
                  )}
                </div>
              </div>
              <div className="text-right flex flex-col items-end gap-1">
                <span className="text-lg font-bold text-primary">
                  ${(order.total_amount || 0).toLocaleString()}
                </span>
                <span className="text-[10px] uppercase font-bold text-primary/80 bg-primary/10 px-2 py-0.5 rounded-sm">
                  {order.status}
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );

  // ── Table grid (shared between mobile and desktop) ──
  const mobileTableGrid = (
    <div className="grid grid-cols-3 gap-3 p-4">
      {tables.map((table) => {
        const orderCount = allActiveOrders.filter(o => o.table_id === table.id).length;
        const isOccupied = orderCount > 0;
        const isSelected = selectedTable?.id === table.id;
        const isPrinted = table.printed_control; // O simplified check
        return (
          <button
            key={table.id}
            onClick={() => handleTableClick(table)}
            className={`flex flex-col items-center justify-center gap-1 text-white font-bold aspect-square transition-all hover:scale-[1.02] active:scale-95 shadow-md ${table.shape === "round" ? "rounded-full" : "rounded-2xl"
              } ${isSelected ? "ring-4 ring-primary ring-offset-2 ring-offset-background shadow-premium" : ""}`}
            style={{
              backgroundColor: isPrinted ? "#3b82f6" : isOccupied ? "hsl(var(--primary))" : "#10b981", // Blue if printed, Emerald if free
              minHeight: 72,
            }}
          >
            <span className="text-xl leading-none tracking-tight">{table.name}</span>
            {isOccupied && table.current_waiter_id && waiterNameMap[table.current_waiter_id] && (
              <span className="text-[10px] uppercase font-medium leading-tight opacity-90 max-w-full truncate px-2 text-center bg-black/20 rounded-full py-0.5 mt-1">
                {waiterNameMap[table.current_waiter_id]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-background/50">
      {/* Area Tabs */}
      {areas.length > 0 && (
        <div className="flex items-center gap-2 px-6 py-3 border-b border-border/50 bg-background/80 backdrop-blur-md overflow-x-auto shrink-0 sticky top-0 z-20">
          {areas.map((area) => {
            const isActive = area.id === selectedAreaId;
            return (
              <button
                key={area.id}
                onClick={() => { setActiveAreaId(area.id); setSelectedTable(null); }}
                className={`px-5 py-2 text-sm font-semibold rounded-full transition-all whitespace-nowrap ${isActive ? "bg-primary text-primary-foreground shadow-sm" : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
              >
                {area.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        {areasLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !selectedAreaId ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            No hay salas configuradas
          </div>
        ) : isMobile ? (
          /* ── MOBILE: split panel ── */
          <div className="flex h-full">
            {/* Left: table list (scrollable) */}
            <div
              className={`overflow-y-auto border-r border-border transition-all duration-200 ${selectedTable ? "w-[30%]" : "w-full"
                }`}
            >
              {selectedTable ? (
                /* Compact single-column when panel is open */
                <div className="flex flex-col gap-2 p-2">
                  {tables.map((table) => {
                    const isOccupied = allActiveOrders.some(o => o.table_id === table.id);
                    const isSelected = selectedTable?.id === table.id;
                    return (
                      <button
                        key={table.id}
                        onClick={() => handleTableClick(table)}
                        className={`flex flex-col items-center justify-center text-white font-bold py-3 transition-all ${table.shape === "round" ? "rounded-full" : "rounded-xl"
                          } ${isSelected ? "ring-2 ring-white ring-offset-1" : ""}`}
                        style={{
                          backgroundColor: isOccupied ? "hsl(0 72% 51%)" : "hsl(142 40% 55%)",
                          minHeight: 56,
                        }}
                      >
                        <span className="text-sm leading-none">{table.name}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                mobileTableGrid
              )}
            </div>

            {/* Right: order detail panel / Dashboard */}
            {selectedTable && (
              <div className="flex-1 overflow-hidden flex flex-col bg-background">
                {activeOrderId && selectedOrder ? (
                  <OrderDetailPanel
                    order={selectedOrder}
                    waiterName={selectedOrder.waiter_id && waiterNameMap[selectedOrder.waiter_id] ? waiterNameMap[selectedOrder.waiter_id] : undefined}
                    onCheckout={(order, activeTotal) => {
                      setCheckoutOrderId(order.id);
                      setCheckoutOrderNumber(order.order_number);
                      setCheckoutTable(selectedTable);
                      setCheckoutConsumedTotal(activeTotal);
                      setCheckoutOrderOverride(null);
                      setCheckoutOpen(true);
                    }}
                    onMoveTable={() => setMoveTableOpen(true)}
                    onSplitSuccess={handleSplitSuccess}
                  />
                ) : (
                  <>
                    <div className="bg-primary text-primary-foreground h-14 flex items-center px-4 gap-3 shrink-0">
                      <div className="flex-1">
                        <h2 className="font-bold">Mesa {selectedTable.name}</h2>
                      </div>
                    </div>
                    {renderTableDashboard()}
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          /* ── DESKTOP: positioned grid ── */
          <div className="p-8 overflow-auto h-full flex items-center justify-center bg-secondary/5">
            <div
              className="grid gap-[10px] p-8 bg-card rounded-[2rem] shadow-premium border border-white/40"
              style={{
                gridTemplateColumns: `repeat(${GRID_COLS}, 80px)`,
                gridTemplateRows: `repeat(${GRID_ROWS}, 80px)`,
              }}
            >
              {Array.from({ length: GRID_ROWS }).map((_, y) =>
                Array.from({ length: GRID_COLS }).map((_, x) => {
                  const table = tableAt(x, y);
                  if (table) {
                    const activeCount = allActiveOrders.filter(o => o.table_id === table.id).length;
                    const isOccupied = activeCount > 0;
                    const isPrinted = table.printed_control;
                    return (
                      <button
                        key={`${x}-${y}`}
                        onClick={() => handleTableClick(table)}
                        className={`flex flex-col items-center justify-center gap-1 text-white font-bold transition-all hover:scale-[1.05] active:scale-95 shadow-md hover:shadow-premium-hover ${table.shape === "round" ? "rounded-full" : "rounded-[1.25rem]"
                          }`}
                        style={{
                          backgroundColor: isPrinted ? "#3b82f6" : isOccupied ? "hsl(var(--primary))" : "#10b981",
                          width: table.size_label === "medium" ? 76 : 64,
                          height: table.size_label === "medium" ? 76 : 64,
                          margin: "auto",
                        }}
                      >
                        <span className="text-xl leading-none tracking-tight">{table.name}</span>
                        {isOccupied && table.current_waiter_id && waiterNameMap[table.current_waiter_id] && (
                          <span className="text-[9px] uppercase font-medium leading-tight opacity-90 max-w-full truncate px-2 text-center bg-black/20 rounded-full py-0.5 mt-0.5">
                            {waiterNameMap[table.current_waiter_id]}
                          </span>
                        )}
                      </button>
                    );
                  }
                  return (
                    <div key={`${x}-${y}`} className="border-2 border-dashed border-border/30 rounded-[1.25rem] bg-secondary/10" />
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Desktop Sheet Override */}
      {!isMobile && (
        <Sheet open={!!selectedTable} onOpenChange={(v) => !v && setSelectedTable(null)}>
          <SheetContent className="w-full sm:max-w-md p-0 flex flex-col gap-0 border-l border-border/50 shadow-2xl">
            {activeOrderId && selectedOrder ? (
              <div className="flex flex-col h-full w-full">
                <div className="bg-card border-b border-border/50 h-10 flex items-center px-4 shrink-0 transition-colors hover:bg-accent cursor-pointer" onClick={() => setActiveOrderId(null)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  <span className="font-medium text-sm">Volver al Dashboard</span>
                </div>
                <OrderDetailPanel
                  order={selectedOrder}
                  waiterName={selectedOrder.waiter_id ? waiterNameMap[selectedOrder.waiter_id] : undefined}
                  onCheckout={(order, activeTotal) => {
                    setCheckoutOrderId(order.id);
                    setCheckoutOrderNumber(order.order_number);
                    if (selectedTable) setCheckoutTable(selectedTable);
                    setCheckoutConsumedTotal(activeTotal);
                    setCheckoutOrderOverride(null);
                    setCheckoutOpen(true);
                  }}
                  onMoveTable={() => setMoveTableOpen(true)}
                  onSplitSuccess={handleSplitSuccess}
                />
              </div>
            ) : (
              <div className="flex flex-col h-full w-full">
                <div className="bg-secondary/20 h-16 flex flex-col justify-center px-6 shrink-0 border-b border-border">
                  <h2 className="font-bold text-lg">Mesa {selectedTable?.name}</h2>
                </div>
                {renderTableDashboard()}
              </div>
            )}
          </SheetContent>
        </Sheet>
      )}

      {/* Full-screen Overlay for Mobile */}
      {isMobile && selectedTable && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          <div className="bg-primary text-primary-foreground h-14 flex items-center px-4 gap-3 shrink-0">
            {activeOrderId ? (
              <>
                <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-white/10" onClick={() => setActiveOrderId(null)}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                  <h2 className="font-bold">Venta #{selectedOrder?.order_number}</h2>
                </div>
              </>
            ) : (
              <>
                <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-white/10" onClick={() => setSelectedTable(null)}>
                  <X className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                  <h2 className="font-bold">Mesa {selectedTable.name}</h2>
                </div>
              </>
            )}
          </div>
          <div className="flex-1 overflow-auto flex flex-col">
            {activeOrderId && selectedOrder ? (
              <OrderDetailPanel
                order={selectedOrder}
                waiterName={selectedOrder.waiter_id ? waiterNameMap[selectedOrder.waiter_id] : undefined}
                onCheckout={(order, activeTotal) => {
                  setCheckoutOrderId(order.id);
                  setCheckoutOrderNumber(order.order_number);
                  if (selectedTable) setCheckoutTable(selectedTable);
                  setCheckoutConsumedTotal(activeTotal);
                  setCheckoutOrderOverride(null);
                  setCheckoutOpen(true);
                }}
                onMoveTable={() => setMoveTableOpen(true)}
                onSplitSuccess={handleSplitSuccess}
              />
            ) : (
              renderTableDashboard()
            )}
          </div>
        </div>
      )}

      {/* Open Table - Drawer on mobile, Dialog on desktop */}
      {isMobile ? (
        <Drawer open={!!dialogTable} onOpenChange={(v) => !v && setDialogTable(null)}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle className="text-center text-xl">
                Mesa {dialogTable?.name}
                <span className="block text-sm font-normal text-muted-foreground mt-0.5">Libre</span>
              </DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-2">{openTableForm}</div>
            <DrawerFooter>{openTableButton}</DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={!!dialogTable} onOpenChange={(v) => !v && setDialogTable(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Abrir Mesa {dialogTable?.name}</DialogTitle>
            </DialogHeader>
            {openTableForm}
            <DialogFooter>{openTableButton}</DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Checkout Dialog */}
      {canCheckout && (
        <CheckoutDialog
          open={checkoutOpen}
          onOpenChange={(v) => {
            if (!v) {
              setCheckoutOpen(false);
              if (checkoutOrderOverride) setCheckoutOrderOverride(null);
            }
          }}
          title={checkoutOrderOverride ? "Cobrar Cuenta Dividida" : "Cerrar Cuenta"}
          subtitle={checkoutOrderOverride ? `Pedido Alterno (Mesa ${checkoutTable?.name})` : `Mesa #${checkoutOrderNumber ?? ""}`}
          consumedTotal={checkoutConsumedTotal}
          closing={closing}
          tipRate={tipRate}
          onConfirm={handleCheckout}
        />
      )}

      {/* Move Table Dialog */}
      <MoveTableDialog
        open={moveTableOpen}
        onOpenChange={setMoveTableOpen}
        sourceTable={selectedTable}
      />
    </div>
  );
}
