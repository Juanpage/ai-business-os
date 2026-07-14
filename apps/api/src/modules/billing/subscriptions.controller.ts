import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { VenueRole } from '@prisma/client';
import { Auth } from '../../common/decorators/auth.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantContext } from '../../common/tenant/tenant-context';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
@Auth()
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  /** Suscripcion vigente del tenant (con su plan). */
  @Get('me')
  findCurrent(@CurrentTenant() ctx: TenantContext) {
    return this.subscriptionsService.findCurrent(ctx);
  }

  /** Suscribir o cambiar de plan. Decision de negocio: solo el owner. */
  @Post()
  @Roles(VenueRole.owner)
  subscribe(@CurrentTenant() ctx: TenantContext, @Body() dto: CreateSubscriptionDto) {
    return this.subscriptionsService.subscribe(ctx, dto);
  }

  @Post('me/cancel')
  @Roles(VenueRole.owner)
  @HttpCode(HttpStatus.OK)
  cancel(@CurrentTenant() ctx: TenantContext) {
    return this.subscriptionsService.cancel(ctx);
  }
}
