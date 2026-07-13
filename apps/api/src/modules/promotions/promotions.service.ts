import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Promotion, PromotionDiscountType, PromotionStatus } from '@prisma/client';
import { TenantContext } from '../../common/tenant/tenant-context';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';

interface PromotionFilters {
  venueId?: string;
  status?: PromotionStatus;
}

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ctx: TenantContext, dto: CreatePromotionDto): Promise<Promotion> {
    if (dto.venueId) {
      await this.assertVenueInTenant(ctx.tenantId, dto.venueId);
    }
    this.assertDiscountValid(dto.discountType, dto.discountValue);

    return this.prisma.promotion.create({
      data: {
        tenantId: ctx.tenantId,
        venueId: dto.venueId ?? null,
        name: dto.name as Prisma.InputJsonValue,
        ...(dto.description !== undefined && {
          description: dto.description as Prisma.InputJsonValue,
        }),
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      },
    });
  }

  async findAll(ctx: TenantContext, filters: PromotionFilters = {}): Promise<Promotion[]> {
    return this.prisma.promotion.findMany({
      where: {
        tenantId: ctx.tenantId,
        deletedAt: null,
        ...(filters.venueId ? { venueId: filters.venueId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(ctx: TenantContext, id: string): Promise<Promotion> {
    const promotion = await this.prisma.promotion.findFirst({
      where: { id, tenantId: ctx.tenantId, deletedAt: null },
    });

    if (!promotion) {
      throw new NotFoundException('Promocion no encontrada.');
    }

    return promotion;
  }

  async update(ctx: TenantContext, id: string, dto: UpdatePromotionDto): Promise<Promotion> {
    const current = await this.findOne(ctx, id);

    // Valida la combinacion resultante tipo/valor (con lo que quede tras el update).
    const nextType = dto.discountType ?? current.discountType;
    const nextValue = dto.discountValue ?? current.discountValue.toNumber();
    this.assertDiscountValid(nextType, nextValue);

    return this.prisma.promotion.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name as Prisma.InputJsonValue }),
        ...(dto.description !== undefined && {
          description: dto.description as Prisma.InputJsonValue,
        }),
        ...(dto.discountType !== undefined && { discountType: dto.discountType }),
        ...(dto.discountValue !== undefined && { discountValue: dto.discountValue }),
        ...(dto.startsAt !== undefined && {
          startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        }),
        ...(dto.endsAt !== undefined && { endsAt: dto.endsAt ? new Date(dto.endsAt) : null }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
  }

  async remove(ctx: TenantContext, id: string): Promise<Promotion> {
    await this.findOne(ctx, id);
    return this.prisma.promotion.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  private assertDiscountValid(type: PromotionDiscountType, value: number): void {
    if (type === PromotionDiscountType.percentage && value > 100) {
      throw new BadRequestException('Un descuento porcentual no puede superar 100.');
    }
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
