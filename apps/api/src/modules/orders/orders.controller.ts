import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { VenueRole } from '@prisma/client';
import { Auth } from '../../common/decorators/auth.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantContext } from '../../common/tenant/tenant-context';
import { ApplyPromotionDto } from './dto/apply-promotion.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
@Auth()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // Operativo: el staff abre y gestiona ordenes (POS).
  @Post()
  create(@CurrentTenant() ctx: TenantContext, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(ctx, dto);
  }

  @Get()
  findAll(@CurrentTenant() ctx: TenantContext, @Query() query: OrderQueryDto) {
    return this.ordersService.findAll(ctx, query);
  }

  @Get(':id')
  findOne(@CurrentTenant() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.findOne(ctx, id);
  }

  @Patch(':id')
  update(
    @CurrentTenant() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderDto,
  ) {
    return this.ordersService.update(ctx, id, dto);
  }

  // Operativo: aplicar/quitar una promocion a la orden (una por orden).
  @Post(':id/promotion')
  applyPromotion(
    @CurrentTenant() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApplyPromotionDto,
  ) {
    return this.ordersService.applyPromotion(ctx, id, dto.promotionId);
  }

  @Delete(':id/promotion')
  removePromotion(@CurrentTenant() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.removePromotion(ctx, id);
  }

  // Eliminar el registro de una orden queda restringido a owner/admin.
  @Delete(':id')
  @Roles(VenueRole.owner, VenueRole.admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentTenant() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    await this.ordersService.remove(ctx, id);
  }
}
