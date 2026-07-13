import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Auth } from '../../common/decorators/auth.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { TenantContext } from '../../common/tenant/tenant-context';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { OrdersService } from './orders.service';

// Sub-recurso de una orden: /api/orders/:orderId/payments
@Controller('orders/:orderId/payments')
@Auth()
export class OrderPaymentsController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  add(
    @CurrentTenant() ctx: TenantContext,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.ordersService.addPayment(ctx, orderId, dto);
  }

  @Get()
  list(@CurrentTenant() ctx: TenantContext, @Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.ordersService.listPayments(ctx, orderId);
  }
}
