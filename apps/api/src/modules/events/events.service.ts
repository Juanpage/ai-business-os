import { Injectable, NotFoundException } from '@nestjs/common';
import { Event, EventStatus, Prisma } from '@prisma/client';
import { TenantContext } from '../../common/tenant/tenant-context';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

interface EventFilters {
  venueId?: string;
  status?: EventStatus;
}

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ctx: TenantContext, dto: CreateEventDto): Promise<Event> {
    await this.assertVenueInTenant(ctx.tenantId, dto.venueId);

    return this.prisma.event.create({
      data: {
        tenantId: ctx.tenantId,
        venueId: dto.venueId,
        name: dto.name as Prisma.InputJsonValue,
        ...(dto.description !== undefined && {
          description: dto.description as Prisma.InputJsonValue,
        }),
        startsAt: new Date(dto.startsAt),
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        capacity: dto.capacity ?? null,
        coverPrice: dto.coverPrice ?? null,
      },
    });
  }

  async findAll(ctx: TenantContext, filters: EventFilters = {}): Promise<Event[]> {
    return this.prisma.event.findMany({
      where: {
        tenantId: ctx.tenantId,
        deletedAt: null,
        ...(filters.venueId ? { venueId: filters.venueId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      orderBy: { startsAt: 'asc' },
    });
  }

  async findOne(ctx: TenantContext, id: string): Promise<Event> {
    const event = await this.prisma.event.findFirst({
      where: { id, tenantId: ctx.tenantId, deletedAt: null },
    });

    if (!event) {
      throw new NotFoundException('Evento no encontrado.');
    }

    return event;
  }

  async update(ctx: TenantContext, id: string, dto: UpdateEventDto): Promise<Event> {
    await this.findOne(ctx, id);

    return this.prisma.event.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name as Prisma.InputJsonValue }),
        ...(dto.description !== undefined && {
          description: dto.description as Prisma.InputJsonValue,
        }),
        ...(dto.startsAt !== undefined && { startsAt: new Date(dto.startsAt) }),
        ...(dto.endsAt !== undefined && { endsAt: dto.endsAt ? new Date(dto.endsAt) : null }),
        ...(dto.capacity !== undefined && { capacity: dto.capacity }),
        ...(dto.coverPrice !== undefined && { coverPrice: dto.coverPrice }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
  }

  async remove(ctx: TenantContext, id: string): Promise<Event> {
    await this.findOne(ctx, id);
    return this.prisma.event.update({ where: { id }, data: { deletedAt: new Date() } });
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
}
