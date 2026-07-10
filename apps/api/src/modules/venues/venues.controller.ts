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
} from '@nestjs/common';
import { VenueRole } from '@prisma/client';
import { Auth } from '../../common/decorators/auth.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantContext } from '../../common/tenant/tenant-context';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { VenuesService } from './venues.service';

@Controller('venues')
@Auth()
export class VenuesController {
  constructor(private readonly venuesService: VenuesService) {}

  @Post()
  @Roles(VenueRole.owner, VenueRole.admin)
  create(@CurrentTenant() ctx: TenantContext, @Body() dto: CreateVenueDto) {
    return this.venuesService.create(ctx, dto);
  }

  @Get()
  findAll(@CurrentTenant() ctx: TenantContext) {
    return this.venuesService.findAll(ctx);
  }

  @Get(':id')
  findOne(@CurrentTenant() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.venuesService.findOne(ctx, id);
  }

  @Patch(':id')
  @Roles(VenueRole.owner, VenueRole.admin)
  update(
    @CurrentTenant() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVenueDto,
  ) {
    return this.venuesService.update(ctx, id, dto);
  }

  @Delete(':id')
  @Roles(VenueRole.owner, VenueRole.admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentTenant() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    await this.venuesService.remove(ctx, id);
  }
}
