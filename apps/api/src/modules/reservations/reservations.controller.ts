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
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ReservationQueryDto } from './dto/reservation-query.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { ReservationsService } from './reservations.service';

@Controller('reservations')
@Auth()
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  // Operativo: el staff gestiona reservas (crear, confirmar, cancelar via status).
  @Post()
  create(@CurrentTenant() ctx: TenantContext, @Body() dto: CreateReservationDto) {
    return this.reservationsService.create(ctx, dto);
  }

  @Get()
  findAll(@CurrentTenant() ctx: TenantContext, @Query() query: ReservationQueryDto) {
    return this.reservationsService.findAll(ctx, query);
  }

  @Get(':id')
  findOne(@CurrentTenant() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.reservationsService.findOne(ctx, id);
  }

  @Patch(':id')
  update(
    @CurrentTenant() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReservationDto,
  ) {
    return this.reservationsService.update(ctx, id, dto);
  }

  // Eliminar el registro de reserva queda restringido a owner/admin.
  @Delete(':id')
  @Roles(VenueRole.owner, VenueRole.admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentTenant() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    await this.reservationsService.remove(ctx, id);
  }
}
