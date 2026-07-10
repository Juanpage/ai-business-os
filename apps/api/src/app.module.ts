import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { VenuesModule } from './modules/venues/venues.module';
import { IdentityModule } from './modules/identity/identity.module';
import { ProductsModule } from './modules/products/products.module';
import { CustomersModule } from './modules/customers/customers.module';
import { TablesModule } from './modules/tables/tables.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { EventsModule } from './modules/events/events.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { AiModule } from './modules/ai/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    TenantsModule,
    VenuesModule,
    IdentityModule,
    ProductsModule,
    CustomersModule,
    TablesModule,
    ReservationsModule,
    EventsModule,
    PromotionsModule,
    OrdersModule,
    PaymentsModule,
    AiModule,
  ],
})
export class AppModule {}
