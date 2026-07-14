import { Module } from '@nestjs/common';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

/** Facturacion SaaS: cobro a los tenants por usar la plataforma. */
@Module({
  controllers: [PlansController, SubscriptionsController],
  providers: [PlansService, SubscriptionsService],
  exports: [PlansService, SubscriptionsService],
})
export class BillingModule {}
