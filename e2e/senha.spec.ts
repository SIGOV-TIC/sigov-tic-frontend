import { test, expect } from './fixtures';
import { SENHA } from './api-falsa';

test.describe('Senha', () => {
  test('conta com senha temporária só entra no sistema depois de trocar', async ({ page, api }) => {
    api.senhaTemporaria.add('pmo');
    await page.goto('/orcamento');
    await expect(page).toHaveURL(/\/login/);
    await page.getByLabel('Usuário').fill('pmo');
    await page.getByLabel('Senha').fill(SENHA);
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page).toHaveURL(/\/primeiro-acesso/);
    await expect(page.getByRole('heading', { name: 'Crie sua senha' })).toBeVisible();

    await page.goto('/portfolio');
    await expect(page).toHaveURL(/\/primeiro-acesso/);

    await page.getByLabel('Senha temporária').fill(SENHA);
    await page.getByLabel('Nova senha', { exact: true }).fill('minha-senha-1');
    await page.getByLabel('Confirmar nova senha').fill('minha-senha-1');
    await page.getByRole('button', { name: 'Salvar e entrar' }).click();

    await expect(page).toHaveURL(/\/portfolio/);
    expect(api.escritasEm('/api/users/me/senha')[0].corpo).toEqual({ senhaAtual: SENHA, novaSenha: 'minha-senha-1' });
  });

  test('senha redefinida pelo admin durante a sessão leva à troca sem derrubar o login', async ({ page, api }) => {
    await api.entrarComo('ana.po');
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    api.senhaTemporaria.add('ana.po');
    await page.goto('/orcamento');
    await expect(page).toHaveURL(/\/primeiro-acesso\?voltar=%2Forcamento/);
    await expect(page.getByText('Ana Carolina, sua conta foi aberta com uma senha temporária')).toBeVisible();
  });

  test('o menu do usuário leva à troca de senha e mostra o erro da senha atual', async ({ page, api }) => {
    await api.entrarComo('pmo');
    await page.goto('/dashboard');
    await page.getByRole('button', { name: /Paula Escritório/ }).click();
    await page.getByRole('menuitem', { name: 'Trocar senha' }).click();

    await expect(page).toHaveURL(/\/configuracoes#senha$/);
    await expect(page.getByLabel('Senha atual')).toBeFocused();

    await page.getByLabel('Senha atual').fill('errada-1');
    await page.getByLabel('Nova senha', { exact: true }).fill('minha-senha-1');
    await page.getByLabel('Confirmar nova senha').fill('minha-senha-1');
    await page.getByRole('button', { name: 'Trocar senha' }).click();
    await expect(page.getByRole('alert')).toHaveText('Senha atual incorreta. Restam 4 tentativas antes do bloqueio.');

    await page.getByLabel('Senha atual').fill(SENHA);
    await page.getByRole('button', { name: 'Trocar senha' }).click();
    await expect(page.getByText('Senha trocada.')).toBeVisible();
    await expect(page.getByLabel('Senha atual')).toHaveValue('');
  });
});
