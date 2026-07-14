import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BillingInterval, SubscriptionStatus } from '@prisma/client';
import { TenantContext } from '../../common/tenant/tenant-context';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

/** Estados en los que una suscripcion se considera vigente. */
const LIVE_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.trialing,
  SubscriptionStatus.active,
  SubscriptionStatus.past_due,
];

const SUBSCRIPTION_INCLUDE = { plan: true } as const;

/** Suma un ciclo de facturacion a una fecha. */
function addInterval(from: Date, interval: BillingInterval): Date {
  const end = new Date(from);
  if (interval === BillingInterval.yearly) {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setMonth(end.getMonth() + 1);
  }
  return end;
}

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Suscribe el tenant a un plan (o cambia de plan). Regla: una sola
   * suscripcion vigente por tenant, asi que la anterior se cancela.
   */
  async subscribe(ctx: TenantContext, dto: CreateSubscriptionDto) {
    const plan = await this.prisma.plan.findFirst({
      where: { id: dto.planId, status: 'active', deletedAt: null },
    });
    if (!plan) {
      throw new NotFoundException('Plan no encontrado o no disponible.');
    }

    const now = new Date();
    const trialing = plan.trialDays > 0;
    const trialEndsAt = trialing
      ? new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000)
      : null;

    return this.prisma.$transaction(async (tx) => {
      // Cierra la suscripcion vigente (cambio de plan).
      await tx.subscription.updateMany({
        where: { tenantId: ctx.tenantId, deletedAt: null, status: { in: LIVE_STATUSES } },
        data: { status: SubscriptionStatus.cancelled, cancelledAt: now },
      });

      return tx.subscription.create({
        data: {
          tenantId: ctx.tenantId,
          planId: plan.id,
          status: trialing ? SubscriptionStatus.trialing : SubscriptionStatus.active,
          currentPeriodStart: now,
          currentPeriodEnd: addInterval(now, plan.interval),
          trialEndsAt,
        },
        include: SUBSCRIPTION_INCLUDE,
      });
    });
  }

  /** Suscripcion mas reciente del tenant (aunque este cancelada). */
  async findCurrent(ctx: TenantContext) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { tenantId: ctx.tenantId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: SUBSCRIPTION_INCLUDE,
    });

    if (!subscription) {
      throw new NotFoundException('El tenant no tiene ninguna suscripcion.');
    }

    return subscription;
  }

  async cancel(ctx: TenantContext) {
    const current = await this.prisma.subscription.findFirst({
      where: { tenantId: ctx.tenantId, deletedAt: null, status: { in: LIVE_STATUSES } },
      orderBy: { createdAt: 'desc' },
    });

    if (!current) {
      throw new ConflictException('No hay una suscripcion vigente que cancelar.');
    }

    return this.prisma.subscription.update({
      where: { id: current.id },
      data: { status: SubscriptionStatus.cancelled, cancelledAt: new Date() },
      include: SUBSCRIPTION_INCLUDE,
    });
  }
}
