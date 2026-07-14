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

export interface Table {
  id: string;
  code: string;
  venueId: string;
  status: string;
}

export interface Customer {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  documentId: string | null;
  venueId: string | null;
  status: string;
}

export interface Reservation {
  id: string;
  venueId: string;
  customerId: string | null;
  tableId: string | null;
  reservedAt: string;
  partySize: number;
  notes: string | null;
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

/**
 * Texto multiidioma en el idioma pedido, con fallback a espanol y luego al
 * primer idioma disponible (asi nunca queda vacio si falta una traduccion).
 */
export function localized(value: Localized, locale: string = 'es'): string {
  return value?.[locale] ?? value?.es ?? Object.values(value ?? {})[0] ?? '';
}
