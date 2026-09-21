#!/usr/bin/env node
/**
 * Genera src/environments/environment.ts y environment.development.ts
 * a partir de apps/web/.env (si existe). Sin .env, no toca los archivos
 * versionados con placeholders. Se ejecuta en prestart/prebuild.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const envPath = join(root, '.env');

if (!existsSync(envPath)) {
  console.log('[env] Sin apps/web/.env — se usan los environments versionados (placeholders).');
  process.exit(0);
}

const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const idx = l.indexOf('=');
      return idx === -1 ? [] : [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^["']|["']$/g, '')];
    })
    .filter((kv) => kv.length === 2),
);

const apiUrl = env['NG_APP_API_URL'] ?? 'http://localhost:3000/api/v1';
const supabaseUrl = env['NG_APP_SUPABASE_URL'] ?? '';
const supabaseAnonKey = env['NG_APP_SUPABASE_ANON_KEY'] ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[env] ⚠️  NG_APP_SUPABASE_URL y NG_APP_SUPABASE_ANON_KEY son obligatorios para login/registro.');
}

const banner = (prod) => `// ⚠️ GENERADO AUTOMÁTICAMENTE por scripts/env-to-environment.mjs desde apps/web/.env
// No editar a mano. production=${prod}
`;

const body = (prod, api) => `export const environment = {
  production: ${prod},
  apiUrl: '${api}',
  supabaseUrl: '${supabaseUrl}',
  supabaseAnonKey: '${supabaseAnonKey}',
};
`;

const envDir = join(root, 'src', 'environments');
writeFileSync(join(envDir, 'environment.ts'), banner(true) + body('true', apiUrl));
writeFileSync(
  join(envDir, 'environment.development.ts'),
  banner(false) + body('false', env['NG_APP_API_URL_DEV'] ?? apiUrl),
);
console.log('[env] environments generados desde .env ✓');
