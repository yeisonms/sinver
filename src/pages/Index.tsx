import { useRef, useState } from "react";
import { Printer } from "lucide-react";
import OrderForm from "@/components/OrderForm";
import TicketPreview from "@/components/TicketPreview";

interface OrderItem {
  name: string;
  qty: number;
  price: number;
}

interface OrderData {
  restaurant: string;
  table: string;
  items: OrderItem[];
  total: number;
}

const defaultOrder: OrderData = {
  restaurant: "La Buena Mesa",
  table: "5",
  items: [
    { name: "Hamburguesa Clásica", qty: 2, price: 8.5 },
    { name: "Papas Fritas", qty: 1, price: 3.0 },
    { name: "Refresco Grande", qty: 2, price: 2.5 },
  ],
  total: 25.0,
};

const Index = () => {
  const [order, setOrder] = useState<OrderData>(defaultOrder);
  const ticketRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Printer className="text-primary" size={24} />
            <h1 className="text-lg font-semibold text-foreground">
              POS Printer Test
            </h1>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            Herramienta de prueba
          </span>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Form */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-5">
              Datos del Ticket
            </h2>
            <OrderForm data={order} onChange={setOrder} />

            <button
              onClick={handlePrint}
              className="w-full mt-6 bg-primary text-primary-foreground font-bold text-lg py-4 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-3"
            >
              <Printer size={22} />
              IMPRIMIR TICKET
            </button>
          </div>

          {/* Right: Preview */}
          <div className="flex flex-col items-center">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-5 self-start">
              Vista Previa
            </h2>
            <div className="bg-muted/30 rounded-lg p-8 w-full flex justify-center">
              <TicketPreview
                ref={ticketRef}
                restaurant={order.restaurant}
                table={order.table}
                items={order.items}
                total={order.total}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
