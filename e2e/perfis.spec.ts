import { test, expect } from './fixtures';

test.describe('O que cada perfil vê e pode fazer', () => {
  test('Escritório: cria projeto, edita o projeto inteiro e a recomendação', async ({ page, api }) => {
    await api.entrarComo('pmo');
    await page.goto('/projeto/p1');
    await expect(page.getByRole('link', { name: 'Editar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Editar Recomendação' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Novo Projeto' })).toBeVisible();
    await page.getByRole('link', { name: 'Editar' }).click();
    await expect(page).toHaveURL(/\/projeto\/p1\/editar/);
  });

  test('PO do projeto: acompanha, mas não edita o projeto inteiro', async ({ page, api }) => {
    await api.entrarComo('ana.po');
    await page.goto('/projeto/p1');
    await expect(page.getByRole('button', { name: 'Registrar atualização' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Editar Ponto de Atenção' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Editar' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Editar Recomendação' })).toHaveCount(0);
    // A rota de edição devolve à tela do projeto.
    await page.goto('/projeto/p1/editar');
    await expect(page).toHaveURL(/\/projeto\/p1$/);
  });

  test('PO de outro projeto e visualizador só leem', async ({ page, api }) => {
    await api.entrarComo('outro.gestor');
    await page.goto('/projeto/p1');
    await expect(page.getByText('Homologação do piloto concluída.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Registrar atualização' })).toHaveCount(0);
    await page.getByRole('button', { name: /Ver detalhes da fase 2/ }).click();
    await expect(page.getByText('Desenvolvimento do módulo RH')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nova atividade' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Concluir fase' })).toHaveCount(0);
  });

  test('admin cuida das contas e não vê criação de projeto', async ({ page, api }) => {
    await api.entrarComo('admin');
    await page.goto('/usuarios');
    await expect(page.getByRole('link', { name: 'Novo Projeto' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Nova conta' }).click();
    await page.locator('input[name=nome]').fill('Thales Souza');
    await page.locator('input[name=login]').fill('thales');
    await page.locator('input[name=senha]').fill('segredo1');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Thales Souza')).toBeVisible();
    expect(api.escritasEm('/api/users')[0].corpo).toMatchObject({ login: 'thales', perfil: 'GESTOR_PROJETO' });
  });

  test('quem não é admin não abre a tela de usuários', async ({ page, api }) => {
    await api.entrarComo('pmo');
    await page.goto('/usuarios');
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
