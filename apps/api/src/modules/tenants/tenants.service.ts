import { Injectable, NotFoundException } from '@nestjs/common';
import { Tenant } from '@prisma/client';
import { TenantContext } from '../../common/tenant/tenant-context';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async findCurrent(ctx: TenantContext): Promise<Tenant> {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: ctx.tenantId, deletedAt: null },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant no encontrado.');
    }

    return tenant;
  }

  async updateCurrent(ctx: TenantContext, dto: UpdateTenantDto): Promise<Tenant> {
    // Garantiza existencia antes de actualizar.
    await this.findCurrent(ctx);

    return this.prisma.tenant.update({
      where: { id: ctx.tenantId },
      data: { name: dto.name, status: dto.status },
    });
  }
}
