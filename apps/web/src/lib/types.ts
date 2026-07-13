// Tipos compartidos del dominio (los montos Decimal llegan como string en JSON).

export type Localized = Record<string, string>;

export interface Venue {
  id: string;
  name: string;
  taxRate: string;
  status: string;
}

export interface Category {
  id: string;
  name: Localized;
  venueId: string | null;
  status: string;
}

export interface Product {
  id: string;
  name: Localized;
  description?: Localized | null;
  price: string;
  venueId: string | null;
  categoryId: string | null;
}

export interface Promotion {
  id: string;
  name: Localized;
  discountType: 'percentage' | 'fixed';
  discountValue: string;
  status: string;
}

export interface OrderItem {
  id: string;
  productId: string | null;
  productName: Localized;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  status: string;
}

export interface Payment {
  id: string;
  amount: string;
  method: string;
  status: string;
}

export interface Order {
  id: string;
  venueId: string;
  promotionId: string | null;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
  status: string;
  items: OrderItem[];
  payments: Payment[];
}

/** Texto multiidioma con preferencia por espanol. */
export function localized(value: Localized): string {
  return value?.es ?? Object.values(value ?? {})[0] ?? '';
}
