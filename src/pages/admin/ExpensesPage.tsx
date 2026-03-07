import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Download, Receipt, ExternalLink, Calendar as CalendarIcon, Filter, Search } from "lucide-react";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExpenseFormDialog } from "@/components/admin/ExpenseFormDialog";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Expense, ExpenseCategory } from "@/types/database";

export default function ExpensesPage() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState("gastos");
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [newCatName, setNewCatName] = useState("");

    // Filters state
    const [dateFilter, setDateFilter] = useState(format(new Date(), "yyyy-MM"));
    const [categoryFilter, setCategoryFilter] = useState("all");

    const { data: expenses = [], isLoading: loadingExpenses } = useQuery({
        queryKey: ["expenses", dateFilter, categoryFilter],
        queryFn: async () => {
            let q = supabase
                .from("expenses")
                .select(`
          *,
          expense_categories(name),
          cash_registers(opened_at)
        `)
                .order("expense_date", { ascending: false });

            if (categoryFilter !== "all") {
                q = q.eq("category_id", categoryFilter);
            }

            const { data, error } = await q;
            if (error) throw error;

            // Basic client side filtering for the month
            const filtered = data.filter((e) => e.expense_date.startsWith(dateFilter));
            return filtered as any[];
        },
    });

    const { data: categories = [], isLoading: loadingCategories } = useQuery({
        queryKey: ["expense-categories"],
        queryFn: async () => {
            const { data, error } = await supabase.from("expense_categories").select("*").order("name");
            if (error) throw error;
            return data as ExpenseCategory[];
        },
    });

    const createCategoryMutation = useMutation({
        mutationFn: async (name: string) => {
            const { error } = await supabase.from("expense_categories").insert({ name });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
            toast.success("Categoría creada");
            setNewCatName("");
        },
        onError: (err: any) => {
            toast.error(err.message || "Error al crear categoría");
        },
    });

    const totalAmount = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

    return (
        <div className="flex flex-col h-full bg-slate-50 relative">
            <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 space-y-6">
                <div className="flex items-center justify-between">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-[400px]">
                        <TabsList className="bg-white border text-muted-foreground font-medium">
                            <TabsTrigger value="gastos" className="data-[state=active]:bg-[#1a2332] data-[state=active]:text-white rounded-md">
                                Gastos
                            </TabsTrigger>
                            <TabsTrigger value="categorias" className="data-[state=active]:bg-[#1a2332] data-[state=active]:text-white rounded-md">
                                Cat. de Gastos
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>

                {activeTab === "gastos" && (
                    <div className="space-y-4">
                        {/* Action Bar */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div className="flex items-center gap-2">
                                <Button variant="outline" className="bg-white" disabled>
                                    <Download className="h-4 w-4 mr-2" />
                                    Exportar
                                </Button>
                                <Button className="bg-[#e65100] hover:bg-[#ff6d00] text-white" onClick={() => setIsFormOpen(true)}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Nuevo gasto
                                </Button>
                            </div>
                        </div>

                        {/* Filters matching mockup logic */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 bg-white p-4 rounded-xl border border-slate-200">
                            <div className="space-y-1.5">
                                <label className="text-xs text-muted-foreground font-medium">Fecha (Mes) *</label>
                                <Input
                                    type="month"
                                    value={dateFilter}
                                    onChange={(e) => setDateFilter(e.target.value)}
                                    className="h-9 text-sm"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs text-muted-foreground font-medium">Categoría</label>
                                <select
                                    value={categoryFilter}
                                    onChange={(e) => setCategoryFilter(e.target.value)}
                                    className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <option value="all">Seleccionar</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* KPIs */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col justify-center items-center py-6">
                                <span className="text-xs text-slate-500 flex items-center gap-1"><Receipt className="h-3 w-3" /> Registros</span>
                                <span className="text-2xl font-bold mt-1">{expenses.length}</span>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col justify-center items-center py-6">
                                <span className="text-xs text-slate-500 font-medium">Total</span>
                                <span className="text-2xl font-bold mt-1 text-slate-900">${totalAmount.toLocaleString()}</span>
                            </div>
                        </div>

                        {/* Data Table */}
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead className="w-[150px]">Fecha de registro</TableHead>
                                        <TableHead>Fecha del gasto</TableHead>
                                        <TableHead>Proveedor</TableHead>
                                        <TableHead>Categoría</TableHead>
                                        <TableHead>Comentario</TableHead>
                                        <TableHead className="text-right">Importe</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loadingExpenses ? (
                                        Array.from({ length: 3 }).map((_, i) => (
                                            <TableRow key={i}>
                                                <TableCell colSpan={6}><Skeleton className="h-10 w-full" /></TableCell>
                                            </TableRow>
                                        ))
                                    ) : expenses.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                                                <div className="flex flex-col items-center justify-center gap-2">
                                                    <Search className="h-8 w-8 text-slate-300" />
                                                    <p className="text-slate-900 font-semibold">No encontramos resultados para tu búsqueda</p>
                                                    <p className="text-xs">Verifica la información ingresada y vuelve a intentarlo.</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        expenses.map((expense) => (
                                            <TableRow key={expense.id}>
                                                <TableCell className="font-medium text-slate-700 text-xs text-nowrap">
                                                    {format(new Date(expense.created_at), "dd/MM/yyyy HH:mm")}
                                                </TableCell>
                                                <TableCell className="text-xs text-slate-600 text-nowrap">
                                                    {format(new Date(expense.expense_date), "dd/MM/yyyy")}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {expense.provider || '—'}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded font-medium">
                                                        {expense.expense_categories?.name || 'Genérica'}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                                                    {expense.notes || '—'}
                                                </TableCell>
                                                <TableCell className="text-right font-bold tabular-nums">
                                                    ${Number(expense.amount).toLocaleString()}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}

                {activeTab === "categorias" && (
                    <div className="bg-white p-6 rounded-xl border border-slate-200 max-w-2xl space-y-6">
                        <div className="flex flex-col sm:flex-row gap-4 items-end">
                            <div className="flex-1 space-y-2">
                                <label className="text-sm font-medium">Nueva Categoría</label>
                                <Input
                                    placeholder="Ej: Servicios Públicos"
                                    value={newCatName}
                                    onChange={(e) => setNewCatName(e.target.value)}
                                />
                            </div>
                            <Button
                                onClick={() => { if (newCatName.trim()) createCategoryMutation.mutate(newCatName.trim()) }}
                                disabled={createCategoryMutation.isPending || !newCatName.trim()}
                                className="bg-[#1a2332] text-white w-full sm:w-auto"
                            >
                                <Plus className="h-4 w-4 mr-2" /> Agregar
                            </Button>
                        </div>

                        <div className="rounded-md border mt-8">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nombre de la Categoría</TableHead>
                                        <TableHead className="w-[100px] text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loadingCategories ? (
                                        <TableRow><TableCell colSpan={2}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                                    ) : categories.length === 0 ? (
                                        <TableRow><TableCell colSpan={2} className="text-center py-8 text-muted-foreground">Sin categorías registradas</TableCell></TableRow>
                                    ) : (
                                        categories.map((c) => (
                                            <TableRow key={c.id}>
                                                <TableCell className="font-medium">{c.name}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="sm" className="text-slate-400 hover:text-red-500" disabled>
                                                        Eliminar
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}
            </div>

            <ExpenseFormDialog
                open={isFormOpen}
                onOpenChange={setIsFormOpen}
                onSuccess={() => setActiveTab("gastos")}
            />
        </div>
    );
}
