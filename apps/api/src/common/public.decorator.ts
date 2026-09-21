import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'manako:isPublic';

/** Marca una ruta como pública (sin JWT requerido). */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
