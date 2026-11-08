import { test, expect } from '@playwright/test';

test('login → inicio → resultados de evaluación Altamar', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByText('Ónix')).toBeVisible();

  await page.getByLabel('Correo').fill('admin@altamar.demo');
  await page.getByLabel('Contraseña').fill('Altamar2026!');
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: 'Inicio' })).toBeVisible();
  await expect(page.getByText(/Grupo Altamar/)).toBeVisible();

  await page.getByRole('navigation').getByRole('link', { name: 'Evaluación' }).click();
  await expect(page).toHaveURL(/\/evaluacion/);

  await page.getByRole('link', { name: 'Resultados y brechas' }).click();
  await expect(page.getByText('Resultados oficiales')).toBeVisible();
  await expect(page.getByText(/Nivel \d+ ·/)).toBeVisible();
});
