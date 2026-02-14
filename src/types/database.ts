export interface Category {
  id: string;
  name: string;
  sort_order: number;
  is_visible_online: boolean;
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
