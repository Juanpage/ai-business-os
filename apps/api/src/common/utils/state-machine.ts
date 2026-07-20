import { BadRequestException } from '@nestjs/common';

/**
 * Valida que una transicion de estado sea permitida. `allowed` mapea cada
 * estado a la lista de estados a los que puede pasar directamente.
 * Quedarse en el mismo estado siempre es valido (no-op).
 */
export function assertValidTransition<S extends string>(
  current: S,
  next: S,
  allowed: Record<S, S[]>,
): void {
  if (current === next) {
    return;
  }

  const allowedNext = allowed[current] ?? [];
  if (!allowedNext.includes(next)) {
    throw new BadRequestException(`Transicion de estado invalida: "${current}" -> "${next}".`);
  }
}
