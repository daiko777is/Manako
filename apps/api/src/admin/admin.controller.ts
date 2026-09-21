import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AdminMetrics, PaymentSummary, UserRole } from '@manako/shared';
import { CurrentUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import type { RequestUser } from '../auth/auth.types';
import { PaymentsService } from '../payments/payments.service';
import { AdminService } from './admin.service';
import { SetRoleDto } from './dto/set-role.dto';
import { SetCourseStatusDto } from './dto/set-course-status.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin')
@Controller({ path: 'admin', version: '1' })
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly payments: PaymentsService,
  ) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Métricas globales de la plataforma' })
  metrics(): Promise<AdminMetrics> {
    return this.admin.getMetrics();
  }

  @Get('users')
  @ApiOperation({ summary: 'Usuarios (búsqueda + paginación cursor)' })
  users(@Query() query: ListUsersQueryDto) {
    return this.admin.listUsers({ search: query.search, cursor: query.cursor, limit: query.limit });
  }

  @Patch('users/:id/role')
  @ApiOperation({ summary: 'Cambiar rol de un usuario (RBAC solo admin)' })
  setRole(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetRoleDto) {
    return this.admin.setUserRole(id, dto.role as UserRole);
  }

  @Get('courses')
  @ApiOperation({ summary: 'Todos los cursos (moderación)' })
  courses(@Query('status') status?: string) {
    return this.admin.listCourses(status as never);
  }

  @Patch('courses/:id/status')
  @ApiOperation({ summary: 'Moderar curso: publicar/archivar/reinciar a borrador' })
  setCourseStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetCourseStatusDto) {
    return this.admin.setCourseStatus(id, dto.status as never);
  }

  @Get('payments')
  @ApiOperation({ summary: 'Pagos de la plataforma (filtro por estado)' })
  paymentsList(@Query() query: ListPaymentsQueryDto) {
    return this.admin.listPayments({
      status: query.status,
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  @Post('payments/:id/refund')
  @ApiOperation({ summary: 'Reembolsar pago (revoca la inscripción)' })
  refund(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string): Promise<PaymentSummary> {
    return this.payments.refund(user.id, id);
  }
}
