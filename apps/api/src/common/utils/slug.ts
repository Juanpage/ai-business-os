import { randomBytes } from 'crypto';

/** Convierte un texto a un slug base (minusculas, sin acentos, separado por guiones). */
export function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/** Genera un slug unico-probable a partir de un nombre (base + sufijo aleatorio). */
export function buildSlug(name: string): string {
  const base = normalizeSlug(name);
  const suffix = randomBytes(3).toString('hex');
  return `${base || 'item'}-${suffix}`;
}
