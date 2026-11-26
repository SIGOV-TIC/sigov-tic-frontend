import { test, expect } from './fixtures';

test.describe('Realizado mês a mês', () => {
  test('o Escritório registra um gasto e o realizado do projeto sobe', async ({ page, api }) => {
    await api.entrarComo('pmo');
    await page.goto('/projeto/p1');
    const cartao = page.locator('app-realizado-mensal');
    await expect(cartao.getByText('Treinamento das áreas.')).toBeVisible();

    await cartao.getByRole('button', { name: 'Registrar gasto' }).click();
    await cartao.getByLabel('Valor (R$)').fill('250000');
    await cartao.getByLabel('Origem').selectOption('Contrato 15/2026');
    await cartao.getByLabel('Motivo').fill('Segunda parcela do treinamento.');
    await cartao.getByRole('button', { name: 'Registrar', exact: true }).click();

    await expect(cartao.getByText('Segunda parcela do treinamento.')).toBeVisible();
    const corpo = api.escritasEm('/gastos')[0].corpo as { valor: number; origem: string; mes: string };
    expect(corpo).toMatchObject({ valor: 250000, origem: 'Contrato 15/2026' });
    expect(corpo.mes).toMatch(/^\d{4}-\d{2}$/);
    await expect(page.locator('.coluna').filter({ hasText: 'Realizado' }).locator('.coluna-valor')).toHaveText('R$ 2,3 mi');
  });

  test('o projeto abre na situação do mês e o histórico traz os meses anteriores', async ({ page, api }) => {
    await api.entrarComo('pmo');
    await page.goto('/projeto/p1');
    const cartao = page.locator('app-realizado-mensal');
    await expect(cartao.locator('.agora')).toContainText('R$ 2.000.000');
    await expect(cartao.getByText('Licenças do primeiro lote.')).toHaveCount(0);
    await cartao.getByRole('button', { name: /Histórico · 2 meses/ }).click();
    await expect(cartao.getByText('Licenças do primeiro lote.')).toBeVisible();
  });

  test('quem não é do Escritório só lê', async ({ page, api }) => {
    await api.entrarComo('ana.po');
    await page.goto('/projeto/p1');
    const cartao = page.locator('app-realizado-mensal');
    await expect(cartao.getByText('Treinamento das áreas.')).toBeVisible();
    await expect(cartao.getByRole('button', { name: 'Registrar gasto' })).toHaveCount(0);
  });

  test('o Orçamento mostra o acumulado do portfólio por mês', async ({ page, api }) => {
    await api.entrarComo('pmo');
    await page.goto('/orcamento');
    await expect(page.getByRole('heading', { name: 'Realizado mês a mês' })).toBeVisible();
    // Abre no mês corrente; o histórico traz o gráfico e os meses anteriores.
    const linhas = page.locator('table.realizado tbody tr');
    await expect(linhas).toHaveCount(1);
    await expect(linhas.first().locator('td').nth(2)).toHaveText('R$ 2,9 mi');
    await page.getByRole('button', { name: 'Histórico' }).click();
    await expect(linhas).toHaveCount(3);
    await expect(page.getByText('Realizado acumulado do portfólio')).toBeVisible();
  });
});
