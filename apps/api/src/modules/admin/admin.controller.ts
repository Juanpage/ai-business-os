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
import { AdminService } from './admin.service';
import { PlatformAuth } from './decorators/platform-auth.decorator';
import { CreatePlanDto, UpdatePlanDto } from './dto/plan.dto';
import { UpdateTenantStatusDto } from './dto/update-tenant-status.dto';

/** Back-office de plataforma. Todas las rutas requieren un admin de plataforma. */
@Controller('admin')
@PlatformAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ---- Tenants ----
  @Get('tenants')
  listTenants() {
    return this.adminService.listTenants();
  }

  @Patch('tenants/:id')
  setTenantStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTenantStatusDto) {
    return this.adminService.setTenantStatus(id, dto);
  }

  // ---- Plans (CRUD, hoy solo lectura en /api/plans) ----
  @Get('plans')
  listPlans() {
    return this.adminService.listPlans();
  }

  @Post('plans')
  createPlan(@Body() dto: CreatePlanDto) {
    return this.adminService.createPlan(dto);
  }

  @Patch('plans/:id')
  updatePlan(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePlanDto) {
    return this.adminService.updatePlan(id, dto);
  }

  @Delete('plans/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removePlan(@Param('id', ParseUUIDPipe) id: string) {
    await this.adminService.removePlan(id);
  }

  // ---- Metrics ----
  @Get('metrics')
  metrics() {
    return this.adminService.metrics();
  }
}
