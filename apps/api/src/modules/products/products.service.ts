import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Product } from '@prisma/client';
import { Paginated, PaginationQueryDto, toSkipTake } from '../../common/dto/pagination.dto';
import { TenantContext } from '../../common/tenant/tenant-context';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

interface ProductFilters extends PaginationQueryDto {
  venueId?: string;
  categoryId?: string;
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ctx: TenantContext, dto: CreateProductDto): Promise<Product> {
    if (dto.venueId) {
      await this.assertVenueInTenant(ctx.tenantId, dto.venueId);
    }
    if (dto.categoryId) {
      await this.assertCategoryInTenant(ctx.tenantId, dto.categoryId);
    }

    return this.prisma.product.create({
      data: {
        tenantId: ctx.tenantId,
        venueId: dto.venueId ?? null,
        categoryId: dto.categoryId ?? null,
        name: dto.name as Prisma.InputJsonValue,
        ...(dto.description !== undefined && {
          description: dto.description as Prisma.InputJsonValue,
        }),
        price: dto.price,
        status: dto.status,
      },
    });
  }

  async findAll(ctx: TenantContext, filters: ProductFilters = {}): Promise<Paginated<Product>> {
    const { skip, take, page, pageSize } = toSkipTake(filters);
    const where = {
      tenantId: ctx.tenantId,
      deletedAt: null,
      ...(filters.venueId ? { venueId: filters.venueId } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.product.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async findOne(ctx: TenantContext, id: string): Promise<Product> {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId: ctx.tenantId, deletedAt: null },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado.');
    }

    return product;
  }

  async update(ctx: TenantContext, id: string, dto: UpdateProductDto): Promise<Product> {
    await this.findOne(ctx, id);

    if (dto.categoryId) {
      await this.assertCategoryInTenant(ctx.tenantId, dto.categoryId);
    }

    return this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name as Prisma.InputJsonValue }),
        ...(dto.description !== undefined && {
          description: dto.description as Prisma.InputJsonValue,
        }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
  }

  async remove(ctx: TenantContext, id: string): Promise<Product> {
    await this.findOne(ctx, id);

    return this.prisma.product.update({
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

  private async assertCategoryInTenant(tenantId: string, categoryId: string): Promise<void> {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, tenantId, deletedAt: null },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException('La categoria indicada no pertenece al tenant.');
    }
  }
}
