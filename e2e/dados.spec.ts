import { test, expect } from './fixtures';

test.describe('Dados', () => {
  test('a tabela abre com os fatos e os filtros recortam', async ({ page, api }) => {
    await api.entrarComo('pmo');
    await page.goto('/dados');

    const linhas = page.locator('tbody tr');
    await expect(linhas.first()).toBeVisible();
    await expect(page.locator('.resumo')).toContainText('linhas');

    await page.getByRole('button', { name: 'IDP · desempenho de prazo' }).click();
    await expect(page).toHaveURL(/metrica=IDP/);
    await expect(page.getByRole('cell', { name: 'IDP · desempenho de prazo' }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Orçado' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Limpar' }).click();
    await expect(page).not.toHaveURL(/metrica=/);
  });

  test('o recorte vem da URL, e o relatório leva até ele', async ({ page, api }) => {
    await api.entrarComo('pmo');
    await page.goto('/status-report');
    await page.getByRole('link', { name: 'Ver todos os dados deste projeto' }).click();

    await expect(page).toHaveURL(/\/dados\?projeto=p1/);
    await expect(page.locator('tbody tr').first()).toBeVisible();
    await expect(page.getByRole('cell', { name: 'ERP', exact: true }).first()).toBeVisible();
  });

  test('sem dado para o recorte a tela diz de onde o dado vem', async ({ page, api }) => {
    await api.entrarComo('pmo');
    await page.goto('/dados?projeto=p2');

    await expect(page.getByText(/Nenhum dado para este recorte/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Baixar CSV' })).toBeDisabled();
  });
});
