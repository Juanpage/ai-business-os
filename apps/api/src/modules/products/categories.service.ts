import { Injectable, NotFoundException } from '@nestjs/common';
import { Category, Prisma } from '@prisma/client';
import { TenantContext } from '../../common/tenant/tenant-context';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ctx: TenantContext, dto: CreateCategoryDto): Promise<Category> {
    if (dto.venueId) {
      await this.assertVenueInTenant(ctx.tenantId, dto.venueId);
    }

    return this.prisma.category.create({
      data: {
        tenantId: ctx.tenantId,
        venueId: dto.venueId ?? null,
        name: dto.name as Prisma.InputJsonValue,
        status: dto.status,
      },
    });
  }

  async findAll(ctx: TenantContext, venueId?: string): Promise<Category[]> {
    return this.prisma.category.findMany({
      where: { tenantId: ctx.tenantId, deletedAt: null, ...(venueId ? { venueId } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(ctx: TenantContext, id: string): Promise<Category> {
    const category = await this.prisma.category.findFirst({
      where: { id, tenantId: ctx.tenantId, deletedAt: null },
    });

    if (!category) {
      throw new NotFoundException('Categoria no encontrada.');
    }

    return category;
  }

  async update(ctx: TenantContext, id: string, dto: UpdateCategoryDto): Promise<Category> {
    await this.findOne(ctx, id);

    return this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name as Prisma.InputJsonValue }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
  }

  async remove(ctx: TenantContext, id: string): Promise<Category> {
    await this.findOne(ctx, id);

    return this.prisma.category.update({
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
