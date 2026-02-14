import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

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

interface OrderFormProps {
  data: OrderData;
  onChange: (data: OrderData) => void;
}

const OrderForm = ({ data, onChange }: OrderFormProps) => {
  const updateField = (field: string, value: string) => {
    onChange({ ...data, [field]: value });
  };

  const addItem = () => {
    const newItems = [...data.items, { name: "", qty: 1, price: 0 }];
    onChange({ ...data, items: newItems });
  };

  const removeItem = (index: number) => {
    const newItems = data.items.filter((_, i) => i !== index);
    const total = newItems.reduce((sum, item) => sum + item.qty * item.price, 0);
    onChange({ ...data, items: newItems, total });
  };

  const updateItem = (index: number, field: keyof OrderItem, value: string | number) => {
    const newItems = [...data.items];
    newItems[index] = { ...newItems[index], [field]: value };
    const total = newItems.reduce((sum, item) => sum + item.qty * item.price, 0);
    onChange({ ...data, items: newItems, total });
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1.5">
          Nombre del Restaurante
        </label>
        <input
          type="text"
          value={data.restaurant}
          onChange={(e) => updateField("restaurant", e.target.value)}
          className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Mi Restaurante"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1.5">
          Número de Mesa
        </label>
        <input
          type="text"
          value={data.table}
          onChange={(e) => updateField("table", e.target.value)}
          className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="5"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-muted-foreground">
            Items del Pedido
          </label>
          <button
            onClick={addItem}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            <Plus size={14} /> Agregar
          </button>
        </div>

        <div className="space-y-2">
          {data.items.map((item, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                type="text"
                value={item.name}
                onChange={(e) => updateItem(i, "name", e.target.value)}
                className="flex-1 bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Producto"
              />
              <input
                type="number"
                value={item.qty}
                onChange={(e) => updateItem(i, "qty", parseInt(e.target.value) || 0)}
                className="w-14 bg-secondary border border-border rounded-md px-2 py-2 text-sm text-foreground text-center focus:outline-none focus:ring-2 focus:ring-ring"
                min="1"
              />
              <input
                type="number"
                value={item.price}
                onChange={(e) => updateItem(i, "price", parseFloat(e.target.value) || 0)}
                className="w-20 bg-secondary border border-border rounded-md px-2 py-2 text-sm text-foreground text-center focus:outline-none focus:ring-2 focus:ring-ring"
                min="0"
                step="0.01"
                placeholder="$0.00"
              />
              <button
                onClick={() => removeItem(i)}
                className="text-muted-foreground hover:text-destructive transition-colors p-1"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-3 border-t border-border">
        <div className="flex justify-between items-center text-lg font-semibold">
          <span className="text-muted-foreground">Total</span>
          <span className="text-primary">${data.total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};

export default OrderForm;
