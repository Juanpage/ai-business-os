import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Venue } from '@prisma/client';
import { TenantContext } from '../../common/tenant/tenant-context';
import { buildSlug, normalizeSlug } from '../../common/utils/slug';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';

@Injectable()
export class VenuesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ctx: TenantContext, dto: CreateVenueDto): Promise<Venue> {
    const slug = dto.slug ? normalizeSlug(dto.slug) : buildSlug(dto.name);

    try {
      return await this.prisma.venue.create({
        data: { tenantId: ctx.tenantId, name: dto.name, slug },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(`Ya existe un venue con el slug "${slug}" en este tenant.`);
      }
      throw error;
    }
  }

  async findAll(ctx: TenantContext): Promise<Venue[]> {
    return this.prisma.venue.findMany({
      where: { tenantId: ctx.tenantId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(ctx: TenantContext, id: string): Promise<Venue> {
    const venue = await this.prisma.venue.findFirst({
      where: { id, tenantId: ctx.tenantId, deletedAt: null },
    });

    if (!venue) {
      throw new NotFoundException('Venue no encontrado.');
    }

    return venue;
  }

  async update(ctx: TenantContext, id: string, dto: UpdateVenueDto): Promise<Venue> {
    // Garantiza pertenencia al tenant antes de actualizar.
    await this.findOne(ctx, id);

    return this.prisma.venue.update({
      where: { id },
      data: { name: dto.name, status: dto.status },
    });
  }

  async remove(ctx: TenantContext, id: string): Promise<Venue> {
    await this.findOne(ctx, id);

    // Soft delete.
    return this.prisma.venue.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
