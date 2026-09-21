import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestUser } from '../auth/auth.types';

/**
 * Inyecta el usuario autenticado (validado desde el JWT de Supabase
 * + profile cargado de BD) en el handler del controller.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof RequestUser | undefined, ctx: ExecutionContext): RequestUser => {
    const request = ctx.switchToHttp().getRequest<{ user: RequestUser }>();
    const user = request.user;
    return data ? (user[data] as never) : user;
  },
);
