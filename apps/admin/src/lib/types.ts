// Tipos del back-office (los montos Decimal llegan como string en JSON).

export interface TenantRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  venues: number;
  users: number;
  plan: { code: string; name: string; price: string } | null;
  subscriptionStatus: string | null;
}

export interface Plan {
  id: string;
  name: string;
  code: string;
  description: string | null;
  price: string;
  interval: 'monthly' | 'yearly';
  trialDays: number;
  maxVenues: number | null;
  maxUsers: number | null;
  status: string;
}

export interface Metrics {
  tenants: { total: number; active: number };
  subscriptionsByStatus: Record<string, number>;
  mrr: number;
}
