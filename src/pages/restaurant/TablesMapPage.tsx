import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Minus, Plus, X, Receipt, ShoppingCart, ArrowLeft, RotateCcw } from "lucide-react";
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
import type { Table } from "@/types/database";
import type { CartItem } from "@/components/restaurant/NewOrderSheet";
import { useFavoriteProducts } from "@/hooks/useOrders";
import { useCategories } from "@/hooks/useCategories";
import { printComanda } from "@/lib/printService";

const GRID_ROWS = 8;
const GRID_COLS = 10;

// ──────────────────────────────────────────────────────────────
// Mobile Order Panel (shown on right side for occupied tables)
// ──────────────────────────────────────────────────────────────
interface OrderPanelProps {
  table: Table;
  orderId: string;
  orderNumber: number | null;
  onAddProducts: () => void;
  onCheckout: (total: number) => void;
  canCheckout: boolean;
  onClose: () => void;
}

function MobileOrderPanel({ table, orderId, orderNumber, onAddProducts, onCheckout, canCheckout, onClose }: OrderPanelProps) {
  const { data: items = [], isLoading } = useQuery<CartItem[]>({
    queryKey: ["order-items", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("*, products:product_id(name)")
        .eq("order_id", orderId)
        .eq("status", "activo");
      if (error) throw error;
      return (data ?? []).map((item: any) => ({
        product_id: item.product_id,
        product_name: item.products?.name ?? "Producto",
        quantity: item.quantity,
        unit_price: item.unit_price,
        notes: item.notes,
      }));
    },
    enabled: !!orderId,
    refetchInterval: 8000,
  });

  const total = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="shrink-0 px-4 py-3 text-white text-center"
        style={{ backgroundColor: "hsl(0 72% 51%)" }}
      >
        <p className="font-bold text-lg leading-tight">Mesa {table.name}</p>
        <p className="text-sm opacity-80">Ocupada</p>
      </div>

      {/* Order number + add button */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-border">
        {orderNumber && (
          <span className="bg-destructive text-destructive-foreground text-xs font-bold px-3 py-1.5 rounded-full">
            Venta {orderNumber}
          </span>
        )}
        <button
          onClick={onAddProducts}
          className="flex items-center gap-1.5 text-sm font-medium text-primary border border-primary rounded-full px-3 py-1.5 hover:bg-primary/10 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar
        </button>
        <div className="flex-1" />
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-auto px-3 py-2">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Sin productos pedidos aún
          </div>
        ) : (
          <div className="space-y-1">
            {items.map((item, i) => (
              <div key={i} className="flex items-center text-sm py-2 border-b border-border/50 last:border-0">
                <span className="w-5 text-muted-foreground shrink-0">{item.quantity}</span>
                <span className="flex-1 font-medium">{item.product_name}</span>
                <span className="text-muted-foreground font-mono text-xs">
                  {(item.unit_price * item.quantity).toLocaleString("es-CO", { minimumFractionDigits: 2 })}
                </span>
                <span className="ml-2 text-muted-foreground hover:text-destructive cursor-pointer">
                  <X className="h-3.5 w-3.5" />
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Total + actions */}
      <div className="shrink-0 border-t border-border px-3 py-3 space-y-2">
        <div className="flex justify-between font-bold text-base">
          <span>Total</span>
          <span>{total.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</span>
        </div>
        {canCheckout && (
          <Button
            className="w-full h-11 font-semibold"
            onClick={() => onCheckout(total)}
            disabled={items.length === 0}
          >
            <Receipt className="h-4 w-4 mr-2" />
            Cobrar total
          </Button>
        )}
      </div>
    </div>
  );
}

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

  // Checkout state
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutOrderId, setCheckoutOrderId] = useState<string | null>(null);
  const [checkoutOrderNumber, setCheckoutOrderNumber] = useState<number | null>(null);
  const [checkoutTable, setCheckoutTable] = useState<Table | null>(null);
  const [checkoutConsumedTotal, setCheckoutConsumedTotal] = useState(0);
  const [closing, setClosing] = useState(false);

  // Fetch order info for selected table (to get order_number)
  const { data: selectedOrder } = useQuery({
    queryKey: ["order", selectedTable?.current_order_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, total_amount, waiter_id, client_name, general_notes")
        .eq("id", selectedTable!.current_order_id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedTable?.current_order_id,
  });

  const tableAt = (x: number, y: number) =>
    tables.find((t) => t.x_position === x && t.y_position === y);

  const handleTableClick = (table: Table) => {
    if (table.status === "libre") {
      setSelectedTable(null);
      setDialogTable(table);
      setDinerCount(1);
      setComment("");
    } else if (table.status === "ocupada") {
      if (isMobile) {
        // Mobile: show split panel
        setSelectedTable(table);
      } else {
        // Desktop: navigate to take-order page
        if (table.current_order_id) {
          navigate(`/restaurant/tables/${table.current_order_id}/take-order`);
        }
      }
    }
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
      if (isMobile) {
        // On mobile, navigate to take order directly
        navigate(`/restaurant/tables/${order.id}/take-order`);
      } else {
        navigate(`/restaurant/tables/${order.id}/take-order`);
      }
    } catch {
      toast.error("Error al abrir mesa");
    }
  };

  const handleCheckout = async (data: { tipAmount: number; paymentMethod: string; grandTotal: number }) => {
    if (!checkoutOrderId || !checkoutTable) return;
    setClosing(true);
    try {
      // Get existing items total
      const { data: orderItems } = await supabase
        .from("order_items")
        .select("quantity, unit_price")
        .eq("order_id", checkoutOrderId)
        .eq("status", "activo");
      const consumedTotal = (orderItems ?? []).reduce((s, i) => s + i.unit_price * i.quantity, 0);

      const { data: openRegister } = await supabase
        .from("cash_registers")
        .select("id")
        .eq("status", "open")
        .maybeSingle();

      const { error: payErr } = await supabase.from("payments").insert({
        order_id: checkoutOrderId,
        cash_register_id: openRegister?.id ?? null,
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
        .eq("id", checkoutOrderId);
      if (orderErr) throw orderErr;

      if (checkoutTable.id) {
        await supabase
          .from("tables")
          .update({ status: "libre", current_order_id: null, current_waiter_id: null })
          .eq("id", checkoutTable.id);
      }

      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["tables"] });
      qc.invalidateQueries({ queryKey: ["sales-orders"] });
      toast.success("Mesa cerrada y cobro registrado");
      setCheckoutOpen(false);
      setSelectedTable(null);
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
      Abrir mesa
    </Button>
  );

  // ── Table grid (shared between mobile and desktop) ──
  const mobileTableGrid = (
    <div className="grid grid-cols-3 gap-2 p-3">
      {tables.map((table) => {
        const isOccupied = table.status === "ocupada";
        const isSelected = selectedTable?.id === table.id;
        return (
          <button
            key={table.id}
            onClick={() => handleTableClick(table)}
            className={`flex flex-col items-center justify-center gap-0.5 text-white font-bold aspect-square transition-all ${
              table.shape === "round" ? "rounded-full" : "rounded-xl"
            } ${isSelected ? "ring-4 ring-white ring-offset-2 ring-offset-background" : ""}`}
            style={{
              backgroundColor: isOccupied ? "hsl(0 72% 51%)" : "hsl(142 40% 55%)",
              minHeight: 72,
            }}
          >
            <span className="text-base leading-none">{table.name}</span>
            {isOccupied && table.current_waiter_id && waiterNameMap[table.current_waiter_id] && (
              <span className="text-[9px] leading-tight opacity-90 max-w-full truncate px-1 text-center">
                {waiterNameMap[table.current_waiter_id]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Area Tabs */}
      {areas.length > 0 && (
        <div className="flex items-center gap-0 px-4 md:px-6 border-b border-border bg-muted/30 overflow-x-auto shrink-0">
          {areas.map((area) => {
            const isActive = area.id === selectedAreaId;
            return (
              <button
                key={area.id}
                onClick={() => { setActiveAreaId(area.id); setSelectedTable(null); }}
                className={`px-4 md:px-5 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
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
              className={`overflow-y-auto border-r border-border transition-all duration-200 ${
                selectedTable ? "w-[30%]" : "w-full"
              }`}
            >
              {selectedTable ? (
                /* Compact single-column when panel is open */
                <div className="flex flex-col gap-2 p-2">
                  {tables.map((table) => {
                    const isOccupied = table.status === "ocupada";
                    const isSelected = selectedTable?.id === table.id;
                    return (
                      <button
                        key={table.id}
                        onClick={() => handleTableClick(table)}
                        className={`flex flex-col items-center justify-center text-white font-bold py-3 transition-all ${
                          table.shape === "round" ? "rounded-full" : "rounded-xl"
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

            {/* Right: order detail panel */}
            {selectedTable && (
              <div className="flex-1 overflow-hidden flex flex-col bg-background">
                <MobileOrderPanel
                  table={selectedTable}
                  orderId={selectedTable.current_order_id!}
                  orderNumber={selectedOrder?.order_number ?? null}
                  canCheckout={canCheckout}
                  onAddProducts={() => {
                    if (selectedTable.current_order_id) {
                      navigate(`/restaurant/tables/${selectedTable.current_order_id}/take-order`);
                    }
                  }}
                  onCheckout={(total) => {
                    setCheckoutOrderId(selectedTable.current_order_id!);
                    setCheckoutOrderNumber(selectedOrder?.order_number ?? null);
                    setCheckoutTable(selectedTable);
                    setCheckoutConsumedTotal(total);
                    setCheckoutOpen(true);
                  }}
                  onClose={() => setSelectedTable(null)}
                />
              </div>
            )}
          </div>
        ) : (
          /* ── DESKTOP: positioned grid ── */
          <div className="p-6 overflow-auto h-full">
            <div
              className="grid gap-1"
              style={{
                gridTemplateColumns: `repeat(${GRID_COLS}, 80px)`,
                gridTemplateRows: `repeat(${GRID_ROWS}, 80px)`,
              }}
            >
              {Array.from({ length: GRID_ROWS }).map((_, y) =>
                Array.from({ length: GRID_COLS }).map((_, x) => {
                  const table = tableAt(x, y);
                  if (table) {
                    const isOccupied = table.status === "ocupada";
                    return (
                      <button
                        key={`${x}-${y}`}
                        onClick={() => handleTableClick(table)}
                        className={`flex flex-col items-center justify-center gap-0.5 text-white font-bold transition-all ${
                          table.shape === "round" ? "rounded-full" : "rounded-lg"
                        }`}
                        style={{
                          backgroundColor: isOccupied ? "hsl(0 72% 51%)" : "hsl(142 71% 45%)",
                          width: table.size_label === "medium" ? 76 : 64,
                          height: table.size_label === "medium" ? 76 : 64,
                          margin: "auto",
                        }}
                      >
                        <span className="text-sm leading-none">{table.name}</span>
                        {isOccupied && table.current_waiter_id && waiterNameMap[table.current_waiter_id] && (
                          <span className="text-[9px] leading-tight opacity-90 max-w-full truncate px-1 text-center">
                            {waiterNameMap[table.current_waiter_id]}
                          </span>
                        )}
                      </button>
                    );
                  }
                  return (
                    <div key={`${x}-${y}`} className="border border-dashed border-border/30 rounded-md" />
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

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
          onOpenChange={setCheckoutOpen}
          title="Cerrar Cuenta"
          subtitle={`Mesa #${checkoutOrderNumber ?? ""}`}
          consumedTotal={checkoutConsumedTotal}
          closing={closing}
          tipRate={tipRate}
          onConfirm={handleCheckout}
        />
      )}
    </div>
  );
}
