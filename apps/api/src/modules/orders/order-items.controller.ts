import { Body, Controller, Delete, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Auth } from '../../common/decorators/auth.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { TenantContext } from '../../common/tenant/tenant-context';
import { AddOrderItemDto } from './dto/add-order-item.dto';
import { UpdateOrderItemDto } from './dto/update-order-item.dto';
import { OrdersService } from './orders.service';

// Sub-recurso de una orden: /api/orders/:orderId/items
@Controller('orders/:orderId/items')
@Auth()
export class OrderItemsController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  add(
    @CurrentTenant() ctx: TenantContext,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: AddOrderItemDto,
  ) {
    return this.ordersService.addItem(ctx, orderId, dto);
  }

  @Patch(':itemId')
  update(
    @CurrentTenant() ctx: TenantContext,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateOrderItemDto,
  ) {
    return this.ordersService.updateItem(ctx, orderId, itemId, dto);
  }

  @Delete(':itemId')
  remove(
    @CurrentTenant() ctx: TenantContext,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.ordersService.removeItem(ctx, orderId, itemId);
  }
}
