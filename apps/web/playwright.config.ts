import { defineConfig, devices } from '@playwright/test';

/**
 * E2E del flujo crítico (spec §11/§12): registro → compra → ver curso →
 * completar lección. Requiere la app corriendo (web :4200 + api :3000) y
 * datos seed. Credenciales demo en variables E2E_USER / E2E_PASS.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env['CI'] ? 2 : 0,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:4200',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: process.env['CI']
    ? undefined
    : undefined, // en local, arrancar `npm run dev` en la raíz del monorepo
});
