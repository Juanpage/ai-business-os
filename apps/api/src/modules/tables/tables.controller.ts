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
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { TablesService } from './tables.service';

@Controller('tables')
@Auth()
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  // Estructural: crear/eliminar mesas es de owner/admin.
  @Post()
  @Roles(VenueRole.owner, VenueRole.admin)
  create(@CurrentTenant() ctx: TenantContext, @Body() dto: CreateTableDto) {
    return this.tablesService.create(ctx, dto);
  }

  @Get()
  findAll(
    @CurrentTenant() ctx: TenantContext,
    @Query('venueId', new ParseUUIDPipe({ optional: true })) venueId?: string,
  ) {
    return this.tablesService.findAll(ctx, venueId);
  }

  @Get(':id')
  findOne(@CurrentTenant() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.tablesService.findOne(ctx, id);
  }

  // Operativo: cambiar estado/codigo de mesa lo puede hacer el staff en servicio.
  @Patch(':id')
  update(
    @CurrentTenant() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTableDto,
  ) {
    return this.tablesService.update(ctx, id, dto);
  }

  @Delete(':id')
  @Roles(VenueRole.owner, VenueRole.admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentTenant() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    await this.tablesService.remove(ctx, id);
  }
}
