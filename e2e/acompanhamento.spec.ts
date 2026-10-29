import { test, expect } from './fixtures';

test.describe('PO acompanha o projeto', () => {
  test.beforeEach(async ({ page, api }) => {
    await api.entrarComo('ana.po');
    await page.goto('/projeto/p1');
    await expect(page.getByRole('heading', { name: 'Implantação do ERP Corporativo' })).toBeVisible();
  });

  test('registra uma atualização datada', async ({ page, api }) => {
    await page.getByRole('button', { name: 'Registrar atualização' }).click();
    await page.getByLabel('Texto da atualização').fill('Contrato do fornecedor aditivado.');
    await page.getByRole('button', { name: 'Registrar', exact: true }).click();
    await expect(page.locator('.atu-lista li').first()).toContainText('Contrato do fornecedor aditivado.');
    expect(api.escritasEm('/atualizacoes')).toHaveLength(1);
  });

  test('cria, conclui e remove uma atividade na fase', async ({ page, api }) => {
    await page.getByRole('button', { name: /Ver detalhes da fase 2/ }).click();
    const camada = page.getByRole('dialog');
    await camada.getByRole('button', { name: 'Nova atividade' }).click();
    await camada.locator('.cf-atv-form input[type=text]').first().fill('Testes integrados');
    await camada.getByRole('button', { name: 'Salvar' }).click();
    await expect(camada.getByText('Testes integrados')).toBeVisible();

    await camada.getByRole('button', { name: 'Concluir Testes integrados' }).click();
    await expect(camada.getByRole('button', { name: 'Reabrir Testes integrados' })).toBeVisible();

    await camada.getByText('Testes integrados').hover();
    await camada.getByRole('button', { name: 'Remover Testes integrados' }).click();
    await expect(camada.getByText('Testes integrados')).toHaveCount(0);

    expect(api.escritasEm('/atividades').map((p) => p.metodo)).toEqual(['POST', 'PUT', 'DELETE']);
  });

  test('concluir a fase grava pelo acompanhamento, nunca pelo projeto inteiro', async ({ page, api }) => {
    await page.getByRole('button', { name: /Ver detalhes da fase 2/ }).click();
    await page.getByRole('button', { name: 'Concluir fase' }).click();
    await expect.poll(() => api.escritasEm('/acompanhamento').length).toBe(1);
    const fases = (api.escritasEm('/acompanhamento')[0].corpo as { fases: { id: string; situacao: string }[] }).fases;
    expect(fases.map((f) => `${f.id}:${f.situacao}`)).toEqual(['f1:CONCLUIDA', 'f2:CONCLUIDA', 'f3:EM_ANDAMENTO']);
    expect(api.escritas.filter((p) => p.metodo === 'PUT' && p.caminho === '/api/projetos/p1')).toHaveLength(0);
  });

  test('edita o ponto de atenção', async ({ page, api }) => {
    await page.getByRole('button', { name: 'Editar Ponto de Atenção' }).click();
    await page.getByLabel('Ponto de Atenção').fill('Risco de atraso na migração.');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Risco de atraso na migração.')).toBeVisible();
    expect((api.escritasEm('/acompanhamento')[0].corpo as { pontoAtencao: string }).pontoAtencao).toBe('Risco de atraso na migração.');
  });

  test('navega entre fases com as setas e fecha com Esc', async ({ page }) => {
    await page.getByRole('button', { name: /Ver detalhes da fase 2/ }).click();
    await expect(page.getByRole('dialog')).toContainText('Fase 2 de 3');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('dialog')).toContainText('Fase 3 de 3');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});
