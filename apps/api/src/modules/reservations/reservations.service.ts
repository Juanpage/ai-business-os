import { Injectable, NotFoundException } from '@nestjs/common';
import { Reservation, ReservationStatus } from '@prisma/client';
import { TenantContext } from '../../common/tenant/tenant-context';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';

interface ReservationFilters {
  venueId?: string;
  status?: ReservationStatus;
}

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

  async findAll(ctx: TenantContext, filters: ReservationFilters = {}): Promise<Reservation[]> {
    return this.prisma.reservation.findMany({
      where: {
        tenantId: ctx.tenantId,
        deletedAt: null,
        ...(filters.venueId ? { venueId: filters.venueId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      orderBy: { reservedAt: 'asc' },
    });
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

    if (dto.customerId) {
      await this.assertCustomerInTenant(ctx.tenantId, dto.customerId);
    }
    if (dto.tableId) {
      // La mesa debe pertenecer al mismo venue de la reserva.
      await this.assertTableInVenue(ctx.tenantId, existing.venueId, dto.tableId);
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
}
