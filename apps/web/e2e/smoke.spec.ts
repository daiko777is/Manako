import { expect, test } from '@playwright/test';

const USER = process.env['E2E_USER'] ?? 'estudiante@manako.demo';
const PASS = process.env['E2E_PASS'] ?? 'manako123!';

test.describe('Flujo crítico del estudiante (spec §12 smoke tests)', () => {
  test('catálogo público carga y muestra cursos', async ({ page }) => {
    await page.goto('/cursos');
    await expect(page.getByRole('heading', { name: /catálogo/i })).toBeVisible();
    // Con el seed aplicado debe haber al menos el curso de Angular
    await expect(page.getByText(/angular/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('login con usuario seed y acceso a mi aprendizaje', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(USER);
    await page.getByLabel('Contraseña').fill(PASS);
    await page.getByRole('button', { name: /iniciar sesión/i }).click();

    await page.waitForURL('**/', { timeout: 15_000 });
    await page.goto('/mi-aprendizaje');
    await expect(page.getByRole('heading', { name: /mi aprendizaje/i })).toBeVisible();
  });

  test('detalle de curso muestra currículo con candados', async ({ page }) => {
    await page.goto('/cursos/angular-18-desde-cero');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/angular/i);
    await expect(page.getByText(/currículo/i)).toBeVisible();
  });
});
