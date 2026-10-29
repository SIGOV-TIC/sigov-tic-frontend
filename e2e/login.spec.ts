import { test, expect } from './fixtures';
import { SENHA } from './api-falsa';

test.describe('Login', () => {
  test('página protegida leva ao login e volta depois de entrar', async ({ page, api }) => {
    void api;
    await page.goto('/orcamento');
    await expect(page).toHaveURL(/\/login\?voltar=%2Forcamento/);
    await page.locator('#usuario').fill('diretoria');
    await page.locator('#senha').fill(SENHA);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/orcamento$/);
    await expect(page.getByRole('heading', { name: 'Orçamento' })).toBeVisible();
  });

  test('senha errada mostra o aviso e não entra', async ({ page, api }) => {
    void api;
    await page.goto('/login');
    await page.locator('#usuario').fill('diretoria');
    await page.locator('#senha').fill('errada');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('alert')).toHaveText('Usuário ou senha incorretos.');
    await expect(page).toHaveURL(/\/login/);
  });

  test('sessão recusada pela API no meio do uso volta ao login', async ({ page, api }) => {
    await api.entrarComo('diretoria');
    await page.goto('/portfolio');
    await expect(page.getByText('Implantação do ERP Corporativo')).toBeVisible();
    api.forcarStatus = 401;
    await page.getByRole('link', { name: 'Orçamento' }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('sair encerra a sessão', async ({ page, api }) => {
    void api;
    await page.goto('/login');
    await page.locator('#usuario').fill('diretoria');
    await page.locator('#senha').fill(SENHA);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.getByRole('button', { name: /Renata Diretoria/ }).click();
    await page.getByRole('menuitem', { name: 'Sair' }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});
