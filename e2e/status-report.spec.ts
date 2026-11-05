import { test, expect } from './fixtures';

test.describe('Status Report', () => {
  test('o Escritório emite a quinzena e o relatório passa a mostrar o documento', async ({ page, api }) => {
    await api.entrarComo('pmo');
    await page.goto('/status-report');

    await expect(page.locator('.rel-tipo', { hasText: /^Prévia ·/ })).toBeVisible();
    await page.getByRole('button', { name: 'Emitir' }).click();

    await expect(page.locator('.rel-tipo', { hasText: /^Status Report ·/ })).toBeVisible();
    await expect(page.getByText(/Emitido em .* por /)).toBeVisible();
    await expect(page.getByText('Fases concluídas')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Emitir novamente' })).toBeVisible();
    expect(api.escritasEm('retratos-quinzenais')).toHaveLength(1);
  });

  test('quem só visualiza não emite', async ({ page, api }) => {
    await api.entrarComo('diretoria');
    await page.goto('/status-report');

    await expect(page.locator('.rel-tipo', { hasText: /^Prévia ·/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Emitir' })).toHaveCount(0);
  });
});

test('o gráfico mostra a série emitida e "ver os dados" abre a mesma tabela', async ({ page, api }) => {
  await api.entrarComo('pmo');
  await page.goto('/status-report');

  const grafico = page.locator('app-grafico-tendencia').first();
  await expect(grafico.locator('svg')).toBeVisible();
  await expect(grafico.getByText('Realizado')).toBeVisible();
  await expect(grafico.getByText('Planejado')).toBeVisible();

  await grafico.getByRole('button', { name: 'Ver os dados' }).click();
  await expect(grafico.locator('table')).toBeVisible();
  await expect(grafico.locator('svg')).toHaveCount(0);
  await expect(grafico.locator('tbody tr')).toHaveCount(5);

  await grafico.getByRole('button', { name: 'Ver o gráfico' }).click();
  await expect(grafico.locator('svg')).toBeVisible();
});

test('o documento impresso abre com bloco de identificação e fecha com os responsáveis', async ({ page, api }) => {
  await api.entrarComo('pmo');
  await page.goto('/status-report');
  await page.getByRole('button', { name: 'Emitir' }).click();
  await page.locator('.rel-tipo', { hasText: /^Status Report ·/ }).waitFor();

  await page.emulateMedia({ media: 'print' });
  await expect(page.getByText('Relatório de Acompanhamento de Projeto')).toBeVisible();
  await expect(page.getByText('Uso interno')).toBeVisible();
  await expect(page.getByText('Identificador')).toBeVisible();
  await expect(page.getByText('Gerente do projeto')).toBeVisible();
  // Na tela, nada disso aparece.
  await page.emulateMedia({ media: 'screen' });
  await expect(page.getByText('Relatório de Acompanhamento de Projeto')).toBeHidden();
});
