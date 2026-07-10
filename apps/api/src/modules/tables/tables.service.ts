import { Injectable, NotFoundException } from '@nestjs/common';
import { Table } from '@prisma/client';
import { TenantContext } from '../../common/tenant/tenant-context';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';

@Injectable()
export class TablesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ctx: TenantContext, dto: CreateTableDto): Promise<Table> {
    await this.assertVenueInTenant(ctx.tenantId, dto.venueId);

    return this.prisma.table.create({
      data: {
        tenantId: ctx.tenantId,
        venueId: dto.venueId,
        code: dto.code,
        status: dto.status,
      },
    });
  }

  async findAll(ctx: TenantContext, venueId?: string): Promise<Table[]> {
    return this.prisma.table.findMany({
      where: { tenantId: ctx.tenantId, deletedAt: null, ...(venueId ? { venueId } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(ctx: TenantContext, id: string): Promise<Table> {
    const table = await this.prisma.table.findFirst({
      where: { id, tenantId: ctx.tenantId, deletedAt: null },
    });

    if (!table) {
      throw new NotFoundException('Mesa no encontrada.');
    }

    return table;
  }

  async update(ctx: TenantContext, id: string, dto: UpdateTableDto): Promise<Table> {
    await this.findOne(ctx, id);

    return this.prisma.table.update({
      where: { id },
      data: {
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
  }

  async remove(ctx: TenantContext, id: string): Promise<Table> {
    await this.findOne(ctx, id);

    return this.prisma.table.update({
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
}
