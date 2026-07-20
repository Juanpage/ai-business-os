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
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomersService } from './customers.service';

@Controller('customers')
@Auth()
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  // Operativo: el staff registra y actualiza clientes durante el servicio.
  @Post()
  create(@CurrentTenant() ctx: TenantContext, @Body() dto: CreateCustomerDto) {
    return this.customersService.create(ctx, dto);
  }

  @Get()
  findAll(@CurrentTenant() ctx: TenantContext, @Query() query: CustomerQueryDto) {
    return this.customersService.findAll(ctx, query);
  }

  @Get(':id')
  findOne(@CurrentTenant() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.findOne(ctx, id);
  }

  @Patch(':id')
  update(
    @CurrentTenant() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(ctx, id, dto);
  }

  // Eliminar un registro de cliente queda restringido a owner/admin.
  @Delete(':id')
  @Roles(VenueRole.owner, VenueRole.admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentTenant() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    await this.customersService.remove(ctx, id);
  }
}
