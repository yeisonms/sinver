export interface Category {
  id: string;
  name: string;
  sort_order: number;
  is_visible_online: boolean;
  show_in_app: boolean;
  show_in_store: boolean;
  show_in_qr: boolean;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  cost: number | null;
  category_id: string | null;
  image_url: string | null;
  is_available: boolean;
  is_tax_included: boolean;
}

export interface Order {
  id: string;
  order_number: number;
  table_id: string | null;
  waiter_id: string | null;
  status: 'pendiente' | 'en_preparacion' | 'listo' | 'entregado' | 'cerrado' | 'cancelado';
  type: 'mesa' | 'domicilio' | 'recoger';
  total_amount: number;
  tip_amount: number;
  created_at: string;
}

export interface Table {
  id: string;
  name: string;
  area_id: string | null;
  capacity: number;
  status: 'libre' | 'ocupada' | 'reservada';
  x_position: number | null;
  y_position: number | null;
}

export interface Printer {
  id: string;
  name: string;
}

export interface CategoryPrinter {
  id: string;
  category_id: string;
  printer_id: string;
}

export interface ModifierGroup {
  id: string;
  name: string;
  public_name: string | null;
  price_logic: 'sum' | 'max' | 'average';
  min_selection: number;
  max_selection: number;
}

export interface ModifierOption {
  id: string;
  modifier_group_id: string;
  name: string;
  price_extra: number;
  max_quantity: number;
}

export interface ProductModifier {
  id: string;
  product_id: string;
  modifier_group_id: string;
}
