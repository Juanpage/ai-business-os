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
import { EventStatus, VenueRole } from '@prisma/client';
import { Auth } from '../../common/decorators/auth.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantContext } from '../../common/tenant/tenant-context';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventsService } from './events.service';

@Controller('events')
@Auth()
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @Roles(VenueRole.owner, VenueRole.admin)
  create(@CurrentTenant() ctx: TenantContext, @Body() dto: CreateEventDto) {
    return this.eventsService.create(ctx, dto);
  }

  @Get()
  findAll(
    @CurrentTenant() ctx: TenantContext,
    @Query('venueId', new ParseUUIDPipe({ optional: true })) venueId?: string,
    @Query('status', new ParseEnumPipe(EventStatus, { optional: true })) status?: EventStatus,
  ) {
    return this.eventsService.findAll(ctx, { venueId, status });
  }

  @Get(':id')
  findOne(@CurrentTenant() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.eventsService.findOne(ctx, id);
  }

  @Patch(':id')
  @Roles(VenueRole.owner, VenueRole.admin)
  update(
    @CurrentTenant() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEventDto,
  ) {
    return this.eventsService.update(ctx, id, dto);
  }

  @Delete(':id')
  @Roles(VenueRole.owner, VenueRole.admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentTenant() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    await this.eventsService.remove(ctx, id);
  }
}
