import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { VenueRole } from '@prisma/client';
import { Request } from 'express';
import { Auth } from '../../common/decorators/auth.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantContext } from '../../common/tenant/tenant-context';
import { AssignRoleDto } from './dto/assign-role.dto';
import { CreateMemberDto } from './dto/create-member.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { IdentityService } from './identity.service';

@Controller('identity')
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.identityService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.identityService.login(dto);
  }

  @Get('me')
  @Auth()
  me(@Req() req: Request, @CurrentTenant() tenant: TenantContext) {
    return { user: req.user, tenant };
  }

  @Post('members')
  @Auth()
  @Roles(VenueRole.owner, VenueRole.admin)
  createMember(@CurrentTenant() ctx: TenantContext, @Body() dto: CreateMemberDto) {
    return this.identityService.createMember(ctx, dto);
  }

  @Get('members')
  @Auth()
  listMembers(@CurrentTenant() ctx: TenantContext) {
    return this.identityService.listMembers(ctx);
  }

  @Post('members/:userId/roles')
  @Auth()
  @Roles(VenueRole.owner)
  assignRole(
    @CurrentTenant() ctx: TenantContext,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: AssignRoleDto,
  ) {
    return this.identityService.assignRole(ctx, userId, dto);
  }
}
