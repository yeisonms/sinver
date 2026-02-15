import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantInfo, type OpeningHours } from "@/hooks/useRestaurantInfo";
import { useCart, type ScheduleOption } from "@/contexts/CartContext";
import type { Category, Product } from "@/types/database";
import { ShoppingCart, Clock, MapPin, Search, CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import ProductDetailModal from "@/components/store/ProductDetailModal";
import CartPanel from "@/components/store/CartPanel";

function isOpenNow(hours: OpeningHours | null): boolean {
  if (!hours) return false;
  const dayMap: Record<number, keyof OpeningHours> = {
    0: "domingo", 1: "lunes", 2: "martes", 3: "miercoles",
    4: "jueves", 5: "viernes", 6: "sabado",
  };
  const now = new Date();
  const day = hours[dayMap[now.getDay()]];
  if (!day?.enabled) return false;
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return day.slots.some((s) => currentTime >= s.open && currentTime <= s.close);
}

function formatPrice(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);
}

export default function StorePage() {
  const { info, isLoading: infoLoading } = useRestaurantInfo();
  const { itemCount, subtotal, deliveryMethod, setDeliveryMethod, schedule, setSchedule } = useCart();
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const { data: categories = [], isLoading: catLoading } = useQuery<Category[]>({
    queryKey: ["store-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("show_in_store", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: products = [], isLoading: prodLoading } = useQuery<Product[]>({
    queryKey: ["store-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_available", true)
        .order("name");
      if (error) throw error;
      // filter to only products whose category is show_in_store
      return data;
    },
  });

  const storeCategories = categories;
  const storeCategoryIds = new Set(storeCategories.map((c) => c.id));

  const filteredProducts = products.filter((p) => {
    if (p.category_id && !storeCategoryIds.has(p.category_id)) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const productsByCategory = storeCategories.map((cat) => ({
    category: cat,
    products: filteredProducts.filter((p) => p.category_id === cat.id),
  })).filter((g) => g.products.length > 0);

  // Uncategorized
  const uncategorized = filteredProducts.filter((p) => !p.category_id);

  const scrollTo = (catId: string) => {
    setActiveCategory(catId);
    sectionRefs.current[catId]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Intersection observer for active category
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveCategory(entry.target.getAttribute("data-cat-id"));
          }
        }
      },
      { rootMargin: "-100px 0px -60% 0px" }
    );
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [productsByCategory]);

  const isOpen = isOpenNow(info?.opening_hours ?? null);
  const loading = infoLoading || catLoading || prodLoading;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background border-b border-border">
        {info?.banner_url && (
          <div className="h-32 md:h-44 w-full overflow-hidden">
            <img src={info.banner_url} alt="Banner" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">{info?.description || "Mi Restaurante"}</h1>
            <Badge variant={isOpen ? "default" : "destructive"} className="text-xs">
              {isOpen ? "Abierto" : "Cerrado"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Select value={deliveryMethod} onValueChange={(v: "pickup" | "delivery") => setDeliveryMethod(v)}>
              <SelectTrigger className="w-[140px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {info?.enable_pickup !== false && <SelectItem value="pickup"><MapPin className="inline w-3.5 h-3.5 mr-1" />Para retirar</SelectItem>}
                {info?.enable_delivery !== false && <SelectItem value="delivery"><MapPin className="inline w-3.5 h-3.5 mr-1" />Domicilio</SelectItem>}
              </SelectContent>
            </Select>
            <ScheduleButton schedule={schedule} onScheduleChange={setSchedule} />
            <Button
              variant="default"
              size="sm"
              className="relative gap-1"
              onClick={() => setCartOpen(true)}
            >
              <ShoppingCart className="w-4 h-4" />
              {itemCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {itemCount}
                </span>
              )}
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex">
        {/* Sidebar */}
        <aside className="hidden md:block w-56 shrink-0 sticky top-[140px] self-start p-4 space-y-1">
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar productos"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
          {storeCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => scrollTo(cat.id)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeCategory === cat.id
                  ? "bg-primary/10 text-primary border-l-2 border-primary"
                  : "hover:bg-muted text-foreground"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </aside>

        {/* Mobile search */}
        <div className="md:hidden px-4 py-2 w-full">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar productos"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto py-2">
            {storeCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => scrollTo(cat.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border ${
                  activeCategory === cat.id ? "bg-primary text-primary-foreground border-primary" : "border-border"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Product grid */}
        <main className="flex-1 p-4 space-y-8">
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-lg" />
              ))}
            </div>
          ) : (
            <>
              {productsByCategory.map(({ category, products: prods }) => (
                <section
                  key={category.id}
                  ref={(el: HTMLDivElement | null) => { sectionRefs.current[category.id] = el; }}
                  data-cat-id={category.id}
                >
                  <h2 className="text-lg font-bold mb-3">{category.name}</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {prods.map((product) => (
                      <ProductCard key={product.id} product={product} onClick={() => setSelectedProduct(product)} />
                    ))}
                  </div>
                </section>
              ))}
              {uncategorized.length > 0 && (
                <section>
                  <h2 className="text-lg font-bold mb-3">Otros</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {uncategorized.map((product) => (
                      <ProductCard key={product.id} product={product} onClick={() => setSelectedProduct(product)} />
                    ))}
                  </div>
                </section>
              )}
              {filteredProducts.length === 0 && (
                <p className="text-center text-muted-foreground py-12">No se encontraron productos.</p>
              )}
            </>
          )}
        </main>
      </div>

      {/* Floating cart bar - mobile */}
      {itemCount > 0 && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 p-3 bg-background border-t border-border z-30">
          <Button className="w-full" onClick={() => setCartOpen(true)}>
            Continuar · {formatPrice(subtotal)}
          </Button>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-border mt-12 py-6 px-4 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-4">
          {info?.whatsapp && <a href={`https://wa.me/${info.whatsapp}`} target="_blank" rel="noreferrer" className="hover:text-foreground">WhatsApp</a>}
          {info?.facebook_url && <a href={info.facebook_url} target="_blank" rel="noreferrer" className="hover:text-foreground">Facebook</a>}
          {info?.instagram_url && <a href={info.instagram_url} target="_blank" rel="noreferrer" className="hover:text-foreground">Instagram</a>}
        </div>
      </footer>

      {/* Modals / Panels */}
      {selectedProduct && (
        <ProductDetailModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}
      <CartPanel open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}

function ProductCard({ product, onClick }: { product: Product; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-left bg-card rounded-lg border border-border overflow-hidden hover:shadow-md transition-shadow group"
    >
      <div className="aspect-square bg-muted overflow-hidden">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">Sin imagen</div>
        )}
      </div>
      <div className="p-3 space-y-1">
        <h3 className="font-semibold text-sm line-clamp-2">{product.name}</h3>
        {product.description && <p className="text-xs text-muted-foreground line-clamp-2">{product.description}</p>}
        <p className="text-sm font-bold text-primary">{formatPrice(product.price)}</p>
      </div>
    </button>
  );
}

function ScheduleButton({ schedule, onScheduleChange }: { schedule: ScheduleOption; onScheduleChange: (s: ScheduleOption) => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"asap" | "scheduled">(schedule.type);
  const [date, setDate] = useState(schedule.type === "scheduled" ? schedule.date : "");
  const [time, setTime] = useState(schedule.type === "scheduled" ? schedule.time : "");

  const handleApply = () => {
    if (mode === "asap") {
      onScheduleChange({ type: "asap" });
    } else if (date && time) {
      onScheduleChange({ type: "scheduled", date, time });
    }
    setOpen(false);
  };

  const label = schedule.type === "asap"
    ? "Lo antes posible"
    : `${schedule.date} ${schedule.time}`;

  // Generate next 7 days
  const dateOptions = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const value = d.toISOString().split("T")[0];
    const dayLabel = i === 0 ? "Hoy" : i === 1 ? "Mañana" : d.toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" });
    return { value, label: dayLabel };
  });

  // Generate time slots (every 30 min)
  const timeOptions: string[] = [];
  for (let h = 8; h <= 22; h++) {
    timeOptions.push(`${String(h).padStart(2, "0")}:00`);
    timeOptions.push(`${String(h).padStart(2, "0")}:30`);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1 text-sm max-w-[200px]">
          {schedule.type === "asap" ? <Clock className="w-3.5 h-3.5 shrink-0" /> : <CalendarClock className="w-3.5 h-3.5 shrink-0" />}
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-4 space-y-4" align="end">
        <p className="font-semibold text-sm">¿Cuándo lo quieres?</p>
        <RadioGroup value={mode} onValueChange={(v) => setMode(v as "asap" | "scheduled")}>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="asap" id="sched-asap" />
            <Label htmlFor="sched-asap" className="text-sm">Lo antes posible</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="scheduled" id="sched-later" />
            <Label htmlFor="sched-later" className="text-sm">Programar</Label>
          </div>
        </RadioGroup>

        {mode === "scheduled" && (
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Fecha</Label>
              <Select value={date} onValueChange={setDate}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecciona día" /></SelectTrigger>
                <SelectContent>
                  {dateOptions.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Hora</Label>
              <Select value={time} onValueChange={setTime}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecciona hora" /></SelectTrigger>
                <SelectContent>
                  {timeOptions.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <Button
          size="sm"
          className="w-full"
          disabled={mode === "scheduled" && (!date || !time)}
          onClick={handleApply}
        >
          Aplicar
        </Button>
      </PopoverContent>
    </Popover>
  );
}
