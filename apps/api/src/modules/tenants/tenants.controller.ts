import { Body, Controller, Get, Patch } from '@nestjs/common';
import { VenueRole } from '@prisma/client';
import { Auth } from '../../common/decorators/auth.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantContext } from '../../common/tenant/tenant-context';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantsService } from './tenants.service';

@Controller('tenants')
@Auth()
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('me')
  findCurrent(@CurrentTenant() ctx: TenantContext) {
    return this.tenantsService.findCurrent(ctx);
  }

  @Patch('me')
  @Roles(VenueRole.owner)
  updateCurrent(@CurrentTenant() ctx: TenantContext, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.updateCurrent(ctx, dto);
  }
}
