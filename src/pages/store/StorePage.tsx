import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantInfo, type OpeningHours } from "@/hooks/useRestaurantInfo";
import { useCart, type ScheduleOption } from "@/contexts/CartContext";
import type { Category, Product } from "@/types/database";
import { ShoppingCart, Clock, MapPin, Search, CalendarClock, Facebook, Instagram, MessageCircle, Twitter, Phone, Mail } from "lucide-react";
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
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-xl border-b border-gray-200 shadow-sm flex flex-col pt-2">
        <div className="max-w-7xl mx-auto w-full px-4 py-3 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            {info?.logo_url && (
              <img src={info.logo_url} alt="Logo" className="w-12 h-12 object-contain rounded-full border border-gray-100 shadow-sm bg-white" />
            )}
            <h1 className="text-xl font-bold text-gray-900">{info?.description || "Mi Restaurante"}</h1>
            <Badge variant={isOpen ? "default" : "destructive"} className="text-[10px] sm:text-xs">
              {isOpen ? "Abierto" : "Cerrado"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Select value={deliveryMethod} onValueChange={(v: "pickup" | "delivery") => setDeliveryMethod(v)}>
              <SelectTrigger className="w-auto md:w-[140px] h-9 text-sm bg-gray-50 border-gray-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {info?.enable_pickup !== false && <SelectItem value="pickup"><MapPin className="inline w-3.5 h-3.5 mr-1" />Retirar</SelectItem>}
                {info?.enable_delivery !== false && <SelectItem value="delivery"><MapPin className="inline w-3.5 h-3.5 mr-1" />Domicilio</SelectItem>}
              </SelectContent>
            </Select>
            <div className="hidden sm:block">
              <ScheduleButton schedule={schedule} onScheduleChange={setSchedule} />
            </div>
            <Button
              variant="default"
              size="sm"
              className="relative h-9 w-9 p-0 rounded-full shadow-md hover:shadow-lg transition-all"
              onClick={() => setCartOpen(true)}
            >
              <ShoppingCart className="w-4 h-4" />
              {itemCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold ring-2 ring-white">
                  {itemCount}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Global Search & Categories Navigation */}
        <div className="max-w-7xl mx-auto w-full px-4 pb-3 flex flex-col gap-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar productos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 w-full bg-gray-100/50 border-gray-200/60 rounded-xl text-sm focus-visible:ring-primary/20 transition-all placeholder:text-gray-400"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar items-center pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
            {storeCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => scrollTo(cat.id)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-300 outline-none ${activeCategory === cat.id
                  ? "bg-primary text-white shadow-md shadow-primary/20 scale-100"
                  : "bg-transparent text-gray-500 hover:bg-gray-100 scale-[0.98] active:scale-95"
                  }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex flex-col items-center w-full">
        <main className="flex-1 p-4 w-full space-y-8">
          {loading ? (
            <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-3xl" />
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
                  <h2 className="text-xl font-bold mb-4 text-gray-900 px-1">{category.name}</h2>
                  <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                    {prods.map((product) => (
                      <ProductCard key={product.id} product={product} onClick={() => setSelectedProduct(product)} />
                    ))}
                  </div>
                </section>
              ))}
              {uncategorized.length > 0 && (
                <section>
                  <h2 className="text-xl font-bold mb-4 text-gray-900 px-1">Otros</h2>
                  <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
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

      {/* Nuevo Footer */}
      <footer className="bg-[#C81E1E] text-white mt-12 pt-12 pb-6">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Col 1 */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              {info?.logo_url && (
                <img src={info.logo_url} alt="Logo" className="w-16 h-16 object-contain rounded-full bg-white/10 p-1" />
              )}
              <h2 className="text-xl font-bold leading-tight">{info?.description || "La Sinverguenceria"}</h2>
            </div>
            {info?.slogan && (
              <p className="text-white/80 text-sm leading-relaxed max-w-sm">
                {info.slogan}
              </p>
            )}
          </div>

          {/* Col 2 */}
          <div className="flex flex-col gap-4">
            <h3 className="text-white font-bold text-lg">Dirección y horarios</h3>
            <ul className="space-y-3 text-sm text-white/90">
              <li className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-white shrink-0 mt-0.5" />
                <span className="leading-snug max-w-xs">{info?.address || "calle 4 # 4-20"}</span>
              </li>
              <li className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-white shrink-0" />
                <span>5:30 pm a 11:00 pm</span>
              </li>
            </ul>
          </div>

          {/* Col 3 */}
          <div className="flex flex-col gap-4">
            <h3 className="text-white font-bold text-lg">Contacto</h3>
            <ul className="space-y-3 text-sm text-white/90">
              <li className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-white shrink-0" />
                <span>{info?.phone || "3184723859"}</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-white shrink-0" />
                <span>{info?.email || "edwinbeto11@gmail.com"}</span>
              </li>
            </ul>
          </div>

          {/* Col 4 */}
          <div className="flex flex-col gap-4">
            <h3 className="text-white font-bold text-lg">Redes sociales</h3>
            <ul className="space-y-3 text-sm text-white/90">
              {info?.whatsapp && (
                <li className="flex items-center gap-3">
                  <a href={`https://wa.me/${info.whatsapp}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 hover:text-white/80 transition-colors">
                    <MessageCircle className="w-4 h-4 text-white shrink-0" />
                    <span>{info.whatsapp}</span>
                  </a>
                </li>
              )}
              {info?.facebook_url && (
                <li className="flex items-center gap-3">
                  <a href={info.facebook_url} target="_blank" rel="noreferrer" className="flex items-center gap-3 hover:text-white/80 transition-colors">
                    <Facebook className="w-4 h-4 text-white shrink-0" />
                    <span>LASINVERGUENCERIA</span>
                  </a>
                </li>
              )}
              {info?.instagram_url && (
                <li className="flex items-center gap-3">
                  <a href={info.instagram_url} target="_blank" rel="noreferrer" className="flex items-center gap-3 hover:text-white/80 transition-colors">
                    <Instagram className="w-4 h-4 text-white shrink-0" />
                    <span>La Sinverguenceria</span>
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/20 pt-6 px-6 max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between text-xs text-white/60 gap-4">
          <p>© 2026 {info?.description || "La Sinverguenceria"}. Todos los derechos reservados.</p>
          <p>Desarrollado por <span className="text-white/80 font-medium">Mursat Solutions</span></p>
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
      className="relative text-left bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-row w-full active:scale-[0.98] cursor-pointer group"
    >
      <div className="w-[120px] h-[120px] shrink-0 bg-gray-50 overflow-hidden">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs text-center p-2">Sin imagen</div>
        )}
      </div>
      <div className="p-3.5 flex-1 flex flex-col justify-between overflow-hidden">
        <div>
          <h3 className="font-semibold text-[15px] text-gray-900 line-clamp-2 leading-tight">{product.name}</h3>
          {product.description && <p className="text-[13px] text-gray-500 line-clamp-2 leading-snug mt-1">{product.description}</p>}
        </div>
        <div className="mt-2 flex items-end justify-between">
          <p className="text-base font-extrabold text-gray-900">{formatPrice(product.price)}</p>
        </div>
      </div>

      {/* Floating Add Button */}
      <div className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-sm">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14"></path>
          <path d="M12 5v14"></path>
        </svg>
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
