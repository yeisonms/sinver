import React, { createContext, useContext, useState, useCallback } from "react";
import type { SelectedModifier } from "@/types/database";

export interface CartItem {
  id: string; // unique cart item id
  product_id: string;
  product_name: string;
  image_url: string | null;
  quantity: number;
  unit_price: number; // base price
  extras_total: number; // sum of modifier extras
  notes: string;
  modifiers: SelectedModifier[];
}

export type ScheduleOption = { type: "asap" } | { type: "scheduled"; date: string; time: string };

interface CartContextType {
  items: CartItem[];
  deliveryMethod: "pickup" | "delivery";
  setDeliveryMethod: (m: "pickup" | "delivery") => void;
  schedule: ScheduleOption;
  setSchedule: (s: ScheduleOption) => void;
  addItem: (item: Omit<CartItem, "id">) => void;
  updateItem: (id: string, item: Partial<CartItem>) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  itemCount: number;
  subtotal: number;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [deliveryMethod, setDeliveryMethod] = useState<"pickup" | "delivery">("pickup");
  const [schedule, setSchedule] = useState<ScheduleOption>({ type: "asap" });

  const addItem = useCallback((item: Omit<CartItem, "id">) => {
    const id = crypto.randomUUID();
    setItems((prev) => [...prev, { ...item, id }]);
  }, []);

  const updateItem = useCallback((id: string, updates: Partial<CartItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const itemCount = items.reduce((s, i) => s + i.quantity, 0);
  const subtotal = items.reduce((s, i) => s + (i.unit_price + i.extras_total) * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, deliveryMethod, setDeliveryMethod, schedule, setSchedule, addItem, updateItem, removeItem, clearCart, itemCount, subtotal }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
