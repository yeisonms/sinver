import { forwardRef } from "react";

interface ReceiptItem {
  name: string;
  quantity: number;
  unit_price: number;
}

interface TableControlReceiptProps {
  restaurantName: string;
  nit: string;
  address: string;
  phone: string;
  taxRegime: string;
  posResolution: string;
  slogan: string;
  footerMessage: string;
  tableName: string;
  orderNumber: number;
  waiterName: string;
  items: ReceiptItem[];
  tipPercentage: number;
}

const TableControlReceipt = forwardRef<HTMLDivElement, TableControlReceiptProps>(
  (
    {
      restaurantName,
      nit,
      address,
      phone,
      taxRegime,
      posResolution,
      slogan,
      footerMessage,
      tableName,
      orderNumber,
      waiterName,
      items,
      tipPercentage,
    },
    ref
  ) => {
    const now = new Date();
    const dateStr = now.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "2-digit" });
    const timeStr = now.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false });

    const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
    const tipAmount = Math.round(subtotal * (tipPercentage / 100));
    const total = subtotal + tipAmount;

    const fmt = (n: number) =>
      n.toLocaleString("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 });

    const SEP = "─".repeat(32);
    const SEP_DASH = "- ".repeat(16);

    return (
      <div
        ref={ref}
        className="receipt-print-area"
        style={{
          width: "80mm",
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: "13px",
          fontWeight: 600,
          color: "#000",
          lineHeight: 1.4,
          padding: "4mm 2mm",
          background: "#fff",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", fontSize: "18px", fontWeight: 800, marginBottom: 4 }}>
          {restaurantName || "MI RESTAURANTE"}
        </div>

        {/* Company data */}
        <div style={{ fontSize: "12px" }}>
          {nit && <div>NIT: {nit}</div>}
          {(address || phone) && (
            <div>
              {address}
              {address && phone ? " - " : ""}
              {phone && `Tel: ${phone}`}
            </div>
          )}
          {taxRegime && <div>{taxRegime}</div>}
          {posResolution && <div>{posResolution}</div>}
        </div>

        {/* Slogan */}
        {slogan && (
          <>
            <div style={{ height: 6 }} />
            <div style={{ textAlign: "center", fontSize: "12px", fontStyle: "italic" }}>{slogan}</div>
          </>
        )}

        <div style={{ marginTop: 6, marginBottom: 4 }}>{SEP}</div>

        {/* Order info */}
        <div style={{ fontSize: "13px" }}>
          <div><b>Mesa:</b> {tableName}</div>
          <div><b>ID:</b> #{orderNumber}</div>
          <div><b>Fecha:</b> {dateStr} {timeStr}</div>
          <div><b>Mesero:</b> {waiterName}</div>
        </div>

        <div style={{ marginTop: 4, marginBottom: 4 }}>{SEP}</div>

        {/* Items */}
        <div>
          {items.map((item, idx) => (
            <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
              <span>
                {item.quantity} x {item.name}
              </span>
              <span>{fmt(item.quantity * item.unit_price)}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 6, marginBottom: 2 }}>{SEP}</div>

        {/* Subtotal */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
          <span>Subtotal</span>
          <span>{fmt(subtotal)}</span>
        </div>

        {/* Detalle de valores */}
        <div style={{ textAlign: "center", fontSize: "11px", margin: "6px 0 4px" }}>
          {SEP_DASH}
          <div>Detalle de Valores</div>
          {SEP_DASH}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
          <span>Vta. Excluida</span>
          <span>{fmt(subtotal)}</span>
        </div>

        {tipPercentage > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginTop: 2 }}>
            <span>PROPINA SUGERIDA ({tipPercentage}%)</span>
            <span>{fmt(tipAmount)}</span>
          </div>
        )}

        <div style={{ marginTop: 6, marginBottom: 2 }}>{SEP}</div>

        {/* Total */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "18px",
            fontWeight: 800,
          }}
        >
          <span>TOTAL</span>
          <span>{fmt(total)}</span>
        </div>

        {/* Footer */}
        {footerMessage && (
          <>
            <div style={{ marginTop: 8 }}>{SEP}</div>
            <div style={{ textAlign: "center", fontSize: "11px", marginTop: 6, whiteSpace: "pre-line" }}>
              {footerMessage}
            </div>
          </>
        )}

        <div style={{ height: "10mm" }} />
      </div>
    );
  }
);

TableControlReceipt.displayName = "TableControlReceipt";
export default TableControlReceipt;
