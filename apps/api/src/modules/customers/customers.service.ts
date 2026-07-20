import { Injectable, NotFoundException } from '@nestjs/common';
import { Customer } from '@prisma/client';
import { Paginated, PaginationQueryDto, toSkipTake } from '../../common/dto/pagination.dto';
import { TenantContext } from '../../common/tenant/tenant-context';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

interface CustomerFilters extends PaginationQueryDto {
  venueId?: string;
}

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ctx: TenantContext, dto: CreateCustomerDto): Promise<Customer> {
    if (dto.venueId) {
      await this.assertVenueInTenant(ctx.tenantId, dto.venueId);
    }

    return this.prisma.customer.create({
      data: {
        tenantId: ctx.tenantId,
        venueId: dto.venueId ?? null,
        fullName: dto.fullName,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        documentId: dto.documentId ?? null,
        status: dto.status,
      },
    });
  }

  async findAll(ctx: TenantContext, filters: CustomerFilters = {}): Promise<Paginated<Customer>> {
    const { skip, take, page, pageSize } = toSkipTake(filters);
    const where = {
      tenantId: ctx.tenantId,
      deletedAt: null,
      ...(filters.venueId ? { venueId: filters.venueId } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.customer.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async findOne(ctx: TenantContext, id: string): Promise<Customer> {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId: ctx.tenantId, deletedAt: null },
    });

    if (!customer) {
      throw new NotFoundException('Cliente no encontrado.');
    }

    return customer;
  }

  async update(ctx: TenantContext, id: string, dto: UpdateCustomerDto): Promise<Customer> {
    await this.findOne(ctx, id);

    return this.prisma.customer.update({
      where: { id },
      data: {
        ...(dto.fullName !== undefined && { fullName: dto.fullName }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.documentId !== undefined && { documentId: dto.documentId }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
  }

  async remove(ctx: TenantContext, id: string): Promise<Customer> {
    await this.findOne(ctx, id);

    return this.prisma.customer.update({
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
