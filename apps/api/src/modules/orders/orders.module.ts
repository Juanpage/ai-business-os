import { Module } from '@nestjs/common';
import { OrderItemsController } from './order-items.controller';
import { OrderPaymentsController } from './order-payments.controller';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  controllers: [OrdersController, OrderItemsController, OrderPaymentsController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
