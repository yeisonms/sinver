import { forwardRef } from "react";

interface OrderItem {
  name: string;
  qty: number;
  price: number;
}

interface TicketProps {
  restaurant: string;
  table: string;
  items: OrderItem[];
  total: number;
}

const TicketPreview = forwardRef<HTMLDivElement, TicketProps>(
  ({ restaurant, table, items, total }, ref) => {
    const now = new Date();
    const date = now.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const time = now.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const dashes = "─".repeat(32);
    const doubleDashes = "═".repeat(32);

    return (
      <div
        id="ticket-preview"
        ref={ref}
        className="w-[80mm] bg-ticket text-ticket-foreground font-mono text-[11px] leading-relaxed p-6 shadow-2xl mx-auto"
        style={{ minHeight: "200px" }}
      >
        {/* Header */}
        <div className="text-center mb-2">
          <div className="text-base font-bold tracking-wide uppercase">
            {restaurant || "RESTAURANTE"}
          </div>
          <div className="text-ticket-muted text-[10px] mt-1">
            Ticket de Prueba
          </div>
        </div>

        <div className="text-ticket-muted text-center">{dashes}</div>

        {/* Info */}
        <div className="flex justify-between my-1">
          <span>Mesa: {table || "--"}</span>
          <span>{date}</span>
        </div>
        <div className="flex justify-between mb-1">
          <span>Ticket: #0001</span>
          <span>{time}</span>
        </div>

        <div className="text-ticket-muted">{dashes}</div>

        {/* Column headers */}
        <div className="flex justify-between font-bold my-1">
          <span className="flex-1">ITEM</span>
          <span className="w-8 text-center">QTY</span>
          <span className="w-16 text-right">PRECIO</span>
        </div>

        <div className="text-ticket-muted">{dashes}</div>

        {/* Items */}
        <div className="my-1 space-y-0.5">
          {items.length === 0 ? (
            <div className="text-ticket-muted text-center italic">
              Sin items
            </div>
          ) : (
            items.map((item, i) => (
              <div key={i} className="flex justify-between">
                <span className="flex-1 truncate">
                  {item.name || "---"}
                </span>
                <span className="w-8 text-center">{item.qty}</span>
                <span className="w-16 text-right">
                  ${(item.qty * item.price).toFixed(2)}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="text-ticket-muted">{doubleDashes}</div>

        {/* Total */}
        <div className="flex justify-between font-bold text-sm my-1">
          <span>TOTAL</span>
          <span>${total.toFixed(2)}</span>
        </div>

        <div className="text-ticket-muted">{doubleDashes}</div>

        {/* Footer */}
        <div className="text-center text-ticket-muted text-[10px] mt-3 space-y-1">
          <div>¡Gracias por su visita!</div>
          <div>*** TICKET DE PRUEBA ***</div>
        </div>
      </div>
    );
  }
);

TicketPreview.displayName = "TicketPreview";

export default TicketPreview;
