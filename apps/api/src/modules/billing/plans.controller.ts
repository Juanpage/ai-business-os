import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { Auth } from '../../common/decorators/auth.decorator';
import { PlansService } from './plans.service';

/** Planes de la plataforma: solo lectura (los define la plataforma, no los tenants). */
@Controller('plans')
@Auth()
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  findAll() {
    return this.plansService.findAllActive();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.plansService.findOne(id);
  }
}
