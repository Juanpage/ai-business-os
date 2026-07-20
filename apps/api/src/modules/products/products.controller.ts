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
import { CreateProductDto } from './dto/create-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@Controller('products')
@Auth()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles(VenueRole.owner, VenueRole.admin)
  create(@CurrentTenant() ctx: TenantContext, @Body() dto: CreateProductDto) {
    return this.productsService.create(ctx, dto);
  }

  @Get()
  findAll(@CurrentTenant() ctx: TenantContext, @Query() query: ProductQueryDto) {
    return this.productsService.findAll(ctx, query);
  }

  @Get(':id')
  findOne(@CurrentTenant() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.findOne(ctx, id);
  }

  @Patch(':id')
  @Roles(VenueRole.owner, VenueRole.admin)
  update(
    @CurrentTenant() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(ctx, id, dto);
  }

  @Delete(':id')
  @Roles(VenueRole.owner, VenueRole.admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentTenant() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    await this.productsService.remove(ctx, id);
  }
}
