import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Plan, Prisma, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePlanDto, UpdatePlanDto } from './dto/plan.dto';
import { UpdateTenantStatusDto } from './dto/update-tenant-status.dto';

/** Estados de suscripcion "vigentes". */
const LIVE_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.trialing,
  SubscriptionStatus.active,
  SubscriptionStatus.past_due,
];

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ========================= Tenants =========================

  /** Lista todos los tenants (cross-tenant, solo plataforma) con su plan y conteos. */
  async listTenants() {
    const tenants = await this.prisma.tenant.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { venues: true, users: true } },
        subscriptions: {
          where: { deletedAt: null, status: { in: LIVE_STATUSES } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { plan: { select: { code: true, name: true, price: true } } },
        },
      },
    });

    return tenants.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: t.status,
      createdAt: t.createdAt,
      venues: t._count.venues,
      users: t._count.users,
      plan: t.subscriptions[0]?.plan ?? null,
      subscriptionStatus: t.subscriptions[0]?.status ?? null,
    }));
  }

  async setTenantStatus(id: string, dto: UpdateTenantStatusDto) {
    const tenant = await this.prisma.tenant.findFirst({ where: { id, deletedAt: null } });
    if (!tenant) {
      throw new NotFoundException('Tenant no encontrado.');
    }
    return this.prisma.tenant.update({ where: { id }, data: { status: dto.status } });
  }

  // ========================= Plans (CRUD) =========================

  listPlans(): Promise<Plan[]> {
    return this.prisma.plan.findMany({
      where: { deletedAt: null },
      orderBy: { price: 'asc' },
    });
  }

  async createPlan(dto: CreatePlanDto): Promise<Plan> {
    try {
      return await this.prisma.plan.create({ data: dto });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`Ya existe un plan con el codigo "${dto.code}".`);
      }
      throw error;
    }
  }

  async updatePlan(id: string, dto: UpdatePlanDto): Promise<Plan> {
    await this.getPlan(id);
    return this.prisma.plan.update({ where: { id }, data: dto });
  }

  async removePlan(id: string): Promise<void> {
    await this.getPlan(id);
    // No se puede borrar un plan con suscripciones vigentes.
    const live = await this.prisma.subscription.count({
      where: { planId: id, deletedAt: null, status: { in: LIVE_STATUSES } },
    });
    if (live > 0) {
      throw new ConflictException('No se puede eliminar un plan con suscripciones vigentes.');
    }
    await this.prisma.plan.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  private async getPlan(id: string): Promise<Plan> {
    const plan = await this.prisma.plan.findFirst({ where: { id, deletedAt: null } });
    if (!plan) {
      throw new NotFoundException('Plan no encontrado.');
    }
    return plan;
  }

  // ========================= Metrics =========================

  async metrics() {
    const [totalTenants, activeTenants, subsByStatus, liveSubs] = await Promise.all([
      this.prisma.tenant.count({ where: { deletedAt: null } }),
      this.prisma.tenant.count({ where: { deletedAt: null, status: 'active' } }),
      this.prisma.subscription.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.subscription.findMany({
        where: { deletedAt: null, status: { in: ['active', 'past_due'] } },
        include: { plan: { select: { price: true } } },
      }),
    ]);

    // MRR = suma del precio de los planes con suscripcion cobrando (excluye trials).
    const mrr = liveSubs.reduce((acc, s) => acc + Number(s.plan.price), 0);

    return {
      tenants: { total: totalTenants, active: activeTenants },
      subscriptionsByStatus: Object.fromEntries(subsByStatus.map((s) => [s.status, s._count._all])),
      mrr: Number(mrr.toFixed(2)),
    };
  }
}
