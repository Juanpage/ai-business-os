import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma, PromotionDiscountType } from '@prisma/client';
import { Paginated, PaginationQueryDto, toSkipTake } from '../../common/dto/pagination.dto';
import { TenantContext } from '../../common/tenant/tenant-context';
import { assertValidTransition } from '../../common/utils/state-machine';
import { PrismaService } from '../../prisma/prisma.service';
import { AddOrderItemDto } from './dto/add-order-item.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { UpdateOrderItemDto } from './dto/update-order-item.dto';

const EDITABLE_STATUSES: OrderStatus[] = [OrderStatus.open, OrderStatus.pending_payment];

/** Transiciones manuales permitidas via PATCH (los pagos ya mueven el estado solos). */
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  open: [OrderStatus.pending_payment, OrderStatus.paid, OrderStatus.cancelled],
  pending_payment: [OrderStatus.paid, OrderStatus.cancelled],
  paid: [OrderStatus.refunded],
  cancelled: [],
  refunded: [],
};

const ORDER_INCLUDE = {
  items: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
  payments: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.OrderInclude;

interface OrderFilters extends PaginationQueryDto {
  venueId?: string;
  status?: OrderStatus;
}

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  // ========================= Orders =========================

  async create(ctx: TenantContext, dto: CreateOrderDto) {
    await this.assertVenueInTenant(ctx.tenantId, dto.venueId);
    if (dto.customerId) {
      await this.assertCustomerInTenant(ctx.tenantId, dto.customerId);
    }
    if (dto.tableId) {
      await this.assertTableInVenue(ctx.tenantId, dto.venueId, dto.tableId);
    }

    const order = await this.prisma.order.create({
      data: {
        tenantId: ctx.tenantId,
        venueId: dto.venueId,
        customerId: dto.customerId ?? null,
        tableId: dto.tableId ?? null,
      },
    });

    return this.findOne(ctx, order.id);
  }

  async findAll(ctx: TenantContext, filters: OrderFilters = {}): Promise<Paginated<unknown>> {
    const { skip, take, page, pageSize } = toSkipTake(filters);
    const where = {
      tenantId: ctx.tenantId,
      deletedAt: null,
      ...(filters.venueId ? { venueId: filters.venueId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: ORDER_INCLUDE,
        skip,
        take,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async findOne(ctx: TenantContext, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, tenantId: ctx.tenantId, deletedAt: null },
      include: ORDER_INCLUDE,
    });

    if (!order) {
      throw new NotFoundException('Orden no encontrada.');
    }

    return order;
  }

  async update(ctx: TenantContext, id: string, dto: UpdateOrderDto) {
    const order = await this.findOne(ctx, id);

    if (dto.status !== undefined) {
      assertValidTransition(order.status, dto.status, ALLOWED_TRANSITIONS);
    }
    if (dto.customerId) {
      await this.assertCustomerInTenant(ctx.tenantId, dto.customerId);
    }
    if (dto.tableId) {
      await this.assertTableInVenue(ctx.tenantId, order.venueId, dto.tableId);
    }

    await this.prisma.order.update({
      where: { id },
      data: {
        ...(dto.customerId !== undefined && { customerId: dto.customerId }),
        ...(dto.tableId !== undefined && { tableId: dto.tableId }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });

    return this.findOne(ctx, id);
  }

  async remove(ctx: TenantContext, id: string) {
    await this.findOne(ctx, id);
    return this.prisma.order.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  // ========================= Items =========================

  async addItem(ctx: TenantContext, orderId: string, dto: AddOrderItemDto) {
    return this.prisma.$transaction(async (tx) => {
      const order = await this.getEditableOrder(tx, ctx, orderId);

      // El producto debe ser del tenant y aplicar a este venue (tenant-wide o del venue).
      const product = await tx.product.findFirst({
        where: {
          id: dto.productId,
          tenantId: ctx.tenantId,
          deletedAt: null,
          OR: [{ venueId: null }, { venueId: order.venueId }],
        },
      });
      if (!product) {
        throw new NotFoundException('Producto no disponible en este venue.');
      }

      const unitPrice = new Prisma.Decimal(product.price);
      const lineTotal = unitPrice.mul(dto.quantity);

      await tx.orderItem.create({
        data: {
          tenantId: ctx.tenantId,
          venueId: order.venueId,
          orderId,
          productId: product.id,
          productName: product.name as Prisma.InputJsonValue,
          quantity: dto.quantity,
          unitPrice,
          lineTotal,
        },
      });

      await this.recalcTotals(tx, orderId);
      return this.findOneTx(tx, ctx, orderId);
    });
  }

  async updateItem(ctx: TenantContext, orderId: string, itemId: string, dto: UpdateOrderItemDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.getEditableOrder(tx, ctx, orderId);

      const item = await tx.orderItem.findFirst({
        where: { id: itemId, orderId, tenantId: ctx.tenantId, deletedAt: null },
      });
      if (!item) {
        throw new NotFoundException('Item no encontrado en la orden.');
      }

      const quantity = dto.quantity ?? item.quantity;
      const lineTotal = new Prisma.Decimal(item.unitPrice).mul(quantity);

      await tx.orderItem.update({
        where: { id: itemId },
        data: {
          ...(dto.quantity !== undefined && { quantity, lineTotal }),
          ...(dto.status !== undefined && { status: dto.status }),
        },
      });

      await this.recalcTotals(tx, orderId);
      return this.findOneTx(tx, ctx, orderId);
    });
  }

  async removeItem(ctx: TenantContext, orderId: string, itemId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.getEditableOrder(tx, ctx, orderId);

      const item = await tx.orderItem.findFirst({
        where: { id: itemId, orderId, tenantId: ctx.tenantId, deletedAt: null },
      });
      if (!item) {
        throw new NotFoundException('Item no encontrado en la orden.');
      }

      await tx.orderItem.update({ where: { id: itemId }, data: { deletedAt: new Date() } });
      await this.recalcTotals(tx, orderId);
      return this.findOneTx(tx, ctx, orderId);
    });
  }

  // ========================= Payments =========================

  async addPayment(ctx: TenantContext, orderId: string, dto: CreatePaymentDto) {
    return this.prisma.$transaction(async (tx) => {
      const order = await this.getOrderTx(tx, ctx, orderId);
      if (order.status === OrderStatus.cancelled || order.status === OrderStatus.refunded) {
        throw new ConflictException('La orden no admite pagos en su estado actual.');
      }

      await tx.payment.create({
        data: {
          tenantId: ctx.tenantId,
          venueId: order.venueId,
          orderId,
          amount: new Prisma.Decimal(dto.amount),
          method: dto.method,
          provider: dto.provider ?? null,
          status: 'paid',
        },
      });

      // Transicion automatica: si lo pagado cubre el total -> paid; si es parcial -> pending_payment.
      const paid = await tx.payment.aggregate({
        where: { orderId, tenantId: ctx.tenantId, deletedAt: null, status: 'paid' },
        _sum: { amount: true },
      });
      const paidSum = new Prisma.Decimal(paid._sum.amount ?? 0);
      const total = new Prisma.Decimal(order.total);

      if (total.gt(0) && paidSum.gte(total)) {
        await tx.order.update({ where: { id: orderId }, data: { status: OrderStatus.paid } });
      } else if (paidSum.gt(0) && order.status === OrderStatus.open) {
        await tx.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.pending_payment },
        });
      }

      return this.findOneTx(tx, ctx, orderId);
    });
  }

  async listPayments(ctx: TenantContext, orderId: string) {
    await this.findOne(ctx, orderId);
    return this.prisma.payment.findMany({
      where: { orderId, tenantId: ctx.tenantId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ========================= Promotions =========================

  async applyPromotion(ctx: TenantContext, orderId: string, promotionId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await this.getEditableOrder(tx, ctx, orderId);

      const promotion = await tx.promotion.findFirst({
        where: {
          id: promotionId,
          tenantId: ctx.tenantId,
          deletedAt: null,
          // A nivel tenant (venueId null) o del mismo venue de la orden.
          OR: [{ venueId: null }, { venueId: order.venueId }],
        },
      });
      if (!promotion) {
        throw new NotFoundException('Promocion no disponible para esta orden.');
      }
      if (promotion.status !== 'active') {
        throw new ConflictException('La promocion no esta activa.');
      }
      const now = new Date();
      if (promotion.startsAt && now < promotion.startsAt) {
        throw new ConflictException('La promocion aun no esta vigente.');
      }
      if (promotion.endsAt && now > promotion.endsAt) {
        throw new ConflictException('La promocion ya expiro.');
      }

      await tx.order.update({ where: { id: orderId }, data: { promotionId } });
      await this.recalcTotals(tx, orderId);
      return this.findOneTx(tx, ctx, orderId);
    });
  }

  async removePromotion(ctx: TenantContext, orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.getEditableOrder(tx, ctx, orderId);
      await tx.order.update({ where: { id: orderId }, data: { promotionId: null } });
      await this.recalcTotals(tx, orderId);
      return this.findOneTx(tx, ctx, orderId);
    });
  }

  // ========================= Helpers =========================

  private async recalcTotals(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        venue: { select: { taxRate: true } },
        promotion: { select: { discountType: true, discountValue: true } },
      },
    });
    const items = await tx.orderItem.findMany({
      where: { orderId, deletedAt: null },
      select: { lineTotal: true },
    });

    let subtotal = new Prisma.Decimal(0);
    for (const item of items) {
      subtotal = subtotal.add(new Prisma.Decimal(item.lineTotal));
    }

    // Descuento (una promo por orden). Nunca supera el subtotal.
    const discountTotal = order.promotion
      ? this.computeDiscount(subtotal, order.promotion.discountType, order.promotion.discountValue)
      : new Prisma.Decimal(0);

    // IVA sobre la base ya descontada.
    const taxableBase = subtotal.sub(discountTotal);
    const taxRate = new Prisma.Decimal(order.venue.taxRate);
    const taxTotal = taxableBase.mul(taxRate).div(100).toDecimalPlaces(2);
    const total = taxableBase.add(taxTotal);

    await tx.order.update({
      where: { id: orderId },
      data: { subtotal, discountTotal, taxTotal, total },
    });
  }

  private computeDiscount(
    subtotal: Prisma.Decimal,
    type: PromotionDiscountType,
    value: Prisma.Decimal | number,
  ): Prisma.Decimal {
    const val = new Prisma.Decimal(value);
    const raw =
      type === PromotionDiscountType.percentage
        ? subtotal.mul(val).div(100).toDecimalPlaces(2)
        : val;
    // No descontar mas que el subtotal (evita totales negativos).
    return raw.gt(subtotal) ? subtotal : raw;
  }

  private async getOrderTx(tx: Prisma.TransactionClient, ctx: TenantContext, orderId: string) {
    const order = await tx.order.findFirst({
      where: { id: orderId, tenantId: ctx.tenantId, deletedAt: null },
    });
    if (!order) {
      throw new NotFoundException('Orden no encontrada.');
    }
    return order;
  }

  private async getEditableOrder(
    tx: Prisma.TransactionClient,
    ctx: TenantContext,
    orderId: string,
  ) {
    const order = await this.getOrderTx(tx, ctx, orderId);
    if (!EDITABLE_STATUSES.includes(order.status)) {
      throw new ConflictException('La orden no es editable en su estado actual.');
    }
    return order;
  }

  private findOneTx(tx: Prisma.TransactionClient, ctx: TenantContext, orderId: string) {
    return tx.order.findFirst({
      where: { id: orderId, tenantId: ctx.tenantId, deletedAt: null },
      include: ORDER_INCLUDE,
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

  private async assertCustomerInTenant(tenantId: string, customerId: string): Promise<void> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!customer) {
      throw new NotFoundException('El cliente indicado no pertenece al tenant.');
    }
  }

  private async assertTableInVenue(
    tenantId: string,
    venueId: string,
    tableId: string,
  ): Promise<void> {
    const table = await this.prisma.table.findFirst({
      where: { id: tableId, tenantId, venueId, deletedAt: null },
      select: { id: true },
    });
    if (!table) {
      throw new NotFoundException('La mesa indicada no pertenece al venue de la orden.');
    }
  }
}
