import { Injectable, NotFoundException } from '@nestjs/common';
import { Customer } from '@prisma/client';
import { TenantContext } from '../../common/tenant/tenant-context';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

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

  async findAll(ctx: TenantContext, venueId?: string): Promise<Customer[]> {
    return this.prisma.customer.findMany({
      where: { tenantId: ctx.tenantId, deletedAt: null, ...(venueId ? { venueId } : {}) },
      orderBy: { createdAt: 'desc' },
    });
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
