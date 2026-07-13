import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PromotionStatus, VenueRole } from '@prisma/client';
import { Auth } from '../../common/decorators/auth.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantContext } from '../../common/tenant/tenant-context';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { PromotionsService } from './promotions.service';

@Controller('promotions')
@Auth()
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Post()
  @Roles(VenueRole.owner, VenueRole.admin)
  create(@CurrentTenant() ctx: TenantContext, @Body() dto: CreatePromotionDto) {
    return this.promotionsService.create(ctx, dto);
  }

  @Get()
  findAll(
    @CurrentTenant() ctx: TenantContext,
    @Query('venueId', new ParseUUIDPipe({ optional: true })) venueId?: string,
    @Query('status', new ParseEnumPipe(PromotionStatus, { optional: true }))
    status?: PromotionStatus,
  ) {
    return this.promotionsService.findAll(ctx, { venueId, status });
  }

  @Get(':id')
  findOne(@CurrentTenant() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.promotionsService.findOne(ctx, id);
  }

  @Patch(':id')
  @Roles(VenueRole.owner, VenueRole.admin)
  update(
    @CurrentTenant() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePromotionDto,
  ) {
    return this.promotionsService.update(ctx, id, dto);
  }

  @Delete(':id')
  @Roles(VenueRole.owner, VenueRole.admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentTenant() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    await this.promotionsService.remove(ctx, id);
  }
}
