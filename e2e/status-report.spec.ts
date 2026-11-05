import { test, expect } from './fixtures';

test.describe('Status Report', () => {
  test('o Escritório emite a quinzena e o relatório passa a mostrar o documento', async ({ page, api }) => {
    await api.entrarComo('pmo');
    await page.goto('/status-report');

    await expect(page.getByText(/^Prévia ·/)).toBeVisible();
    await page.getByRole('button', { name: 'Emitir' }).click();

    await expect(page.getByText(/^Status Report ·/)).toBeVisible();
    await expect(page.getByText(/Emitido em .* por /)).toBeVisible();
    await expect(page.getByText('Fases concluídas')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Emitir novamente' })).toBeVisible();
    expect(api.escritasEm('retratos-quinzenais')).toHaveLength(1);
  });

  test('quem só visualiza não emite', async ({ page, api }) => {
    await api.entrarComo('diretoria');
    await page.goto('/status-report');

    await expect(page.getByText(/^Prévia ·/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Emitir' })).toHaveCount(0);
  });
});
