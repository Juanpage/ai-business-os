import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Reservation, ReservationStatus } from '@prisma/client';
import { Paginated, PaginationQueryDto, toSkipTake } from '../../common/dto/pagination.dto';
import { TenantContext } from '../../common/tenant/tenant-context';
import { assertValidTransition } from '../../common/utils/state-machine';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';

interface ReservationFilters extends PaginationQueryDto {
  venueId?: string;
  status?: ReservationStatus;
}

/** Estados que ya no ocupan la mesa (no cuentan para el solapamiento). */
const INACTIVE_STATUSES: ReservationStatus[] = [
  ReservationStatus.cancelled,
  ReservationStatus.no_show,
];

/** Ventana alrededor de una reserva dentro de la que la misma mesa no admite otra. */
const OVERLAP_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 horas

/** Transiciones permitidas del flujo de una reserva. */
const ALLOWED_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  pending: [ReservationStatus.confirmed, ReservationStatus.cancelled, ReservationStatus.no_show],
  confirmed: [ReservationStatus.seated, ReservationStatus.cancelled, ReservationStatus.no_show],
  seated: [ReservationStatus.completed, ReservationStatus.cancelled],
  cancelled: [],
  no_show: [],
  completed: [],
};

@Injectable()
export class ReservationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ctx: TenantContext, dto: CreateReservationDto): Promise<Reservation> {
    await this.assertVenueInTenant(ctx.tenantId, dto.venueId);
    if (dto.customerId) {
      await this.assertCustomerInTenant(ctx.tenantId, dto.customerId);
    }
    if (dto.tableId) {
      await this.assertTableInVenue(ctx.tenantId, dto.venueId, dto.tableId);
      await this.assertNoOverlap(ctx.tenantId, dto.tableId, new Date(dto.reservedAt));
    }

    return this.prisma.reservation.create({
      data: {
        tenantId: ctx.tenantId,
        venueId: dto.venueId,
        customerId: dto.customerId ?? null,
        tableId: dto.tableId ?? null,
        reservedAt: new Date(dto.reservedAt),
        partySize: dto.partySize,
        notes: dto.notes ?? null,
        status: dto.status,
      },
    });
  }

  async findAll(
    ctx: TenantContext,
    filters: ReservationFilters = {},
  ): Promise<Paginated<Reservation>> {
    const { skip, take, page, pageSize } = toSkipTake(filters);
    const where = {
      tenantId: ctx.tenantId,
      deletedAt: null,
      ...(filters.venueId ? { venueId: filters.venueId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.reservation.findMany({ where, orderBy: { reservedAt: 'asc' }, skip, take }),
      this.prisma.reservation.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async findOne(ctx: TenantContext, id: string): Promise<Reservation> {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id, tenantId: ctx.tenantId, deletedAt: null },
    });

    if (!reservation) {
      throw new NotFoundException('Reserva no encontrada.');
    }

    return reservation;
  }

  async update(ctx: TenantContext, id: string, dto: UpdateReservationDto): Promise<Reservation> {
    const existing = await this.findOne(ctx, id);

    if (dto.status !== undefined) {
      assertValidTransition(existing.status, dto.status, ALLOWED_TRANSITIONS);
    }
    if (dto.customerId) {
      await this.assertCustomerInTenant(ctx.tenantId, dto.customerId);
    }
    if (dto.tableId) {
      // La mesa debe pertenecer al mismo venue de la reserva.
      await this.assertTableInVenue(ctx.tenantId, existing.venueId, dto.tableId);
    }

    // Si cambia la mesa o la hora, revalida que no choque con otra reserva activa.
    const nextTableId = dto.tableId !== undefined ? dto.tableId : existing.tableId;
    const nextReservedAt =
      dto.reservedAt !== undefined ? new Date(dto.reservedAt) : existing.reservedAt;
    if (nextTableId && (dto.tableId !== undefined || dto.reservedAt !== undefined)) {
      await this.assertNoOverlap(ctx.tenantId, nextTableId, nextReservedAt, id);
    }

    return this.prisma.reservation.update({
      where: { id },
      data: {
        ...(dto.reservedAt !== undefined && { reservedAt: new Date(dto.reservedAt) }),
        ...(dto.partySize !== undefined && { partySize: dto.partySize }),
        ...(dto.customerId !== undefined && { customerId: dto.customerId }),
        ...(dto.tableId !== undefined && { tableId: dto.tableId }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
  }

  async remove(ctx: TenantContext, id: string): Promise<Reservation> {
    await this.findOne(ctx, id);

    return this.prisma.reservation.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private async assertVenueInTenant(tenantId: string, venueId: string): Promise<void> {
    const venue = await this.prisma.venue.findFirst({
      where: { id: venueId, tenantId, deletedAt: null },
      select: { id: true },
    });

    if (!venue) {
      throw new NotFoundException('El venue indicado no pertenece al tenant.');
    }
  }

  private async assertCustomerInTenant(tenantId: string, customerId: string): Promise<void> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null },
      select: { id: true },
    });

    if (!customer) {
      throw new NotFoundException('El cliente indicado no pertenece al tenant.');
    }
  }

  private async assertTableInVenue(
    tenantId: string,
    venueId: string,
    tableId: string,
  ): Promise<void> {
    const table = await this.prisma.table.findFirst({
      where: { id: tableId, tenantId, venueId, deletedAt: null },
      select: { id: true },
    });

    if (!table) {
      throw new NotFoundException('La mesa indicada no pertenece al venue de la reserva.');
    }
  }

  /** Rechaza si la mesa ya tiene otra reserva activa dentro de la ventana de 2h. */
  private async assertNoOverlap(
    tenantId: string,
    tableId: string,
    reservedAt: Date,
    excludeReservationId?: string,
  ): Promise<void> {
    const windowStart = new Date(reservedAt.getTime() - OVERLAP_WINDOW_MS);
    const windowEnd = new Date(reservedAt.getTime() + OVERLAP_WINDOW_MS);

    const conflict = await this.prisma.reservation.findFirst({
      where: {
        tenantId,
        tableId,
        deletedAt: null,
        status: { notIn: INACTIVE_STATUSES },
        reservedAt: { gte: windowStart, lte: windowEnd },
        ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
      },
      select: { id: true, reservedAt: true },
    });

    if (conflict) {
      throw new ConflictException(
        `La mesa ya tiene una reserva a las ${conflict.reservedAt.toISOString()} (dentro de una ventana de 2 horas).`,
      );
    }
  }
}
