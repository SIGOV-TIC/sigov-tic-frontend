import { test, expect } from './fixtures';

// PNG de 1x1 pixel.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

test.describe('Configurações da conta', () => {
  test('o menu abre a página e a alteração aparece no menu', async ({ page, api }) => {
    await api.entrarComo('pmo');
    await page.goto('/dashboard');
    await page.getByRole('button', { name: /Paula Escritório/ }).click();
    await page.getByRole('menuitem', { name: 'Configurações' }).click();
    await expect(page).toHaveURL(/\/configuracoes$/);

    await page.getByLabel('Nome').fill('Paula Souza');
    await page.getByLabel('Cargo').fill('Gerente do Escritório');
    await page.locator('input[type=file]').setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.locator('.avatar img')).toBeVisible();
    await page.getByRole('button', { name: 'Salvar' }).click();

    await expect(page.getByText('Alterações salvas.')).toBeVisible();
    const [escrita] = api.escritasEm('/api/users/me');
    expect(escrita.corpo).toMatchObject({ nome: 'Paula Souza', cargo: 'Gerente do Escritório' });
    expect((escrita.corpo as { foto: string }).foto).toMatch(/^data:image\/jpeg;base64,/);
    await expect(page.getByRole('button', { name: /Paula Souza/ })).toBeVisible();
    await expect(page.locator('.menu-avatar img')).toBeVisible();
  });

  test('falha do servidor mostra a causa e permite tentar de novo', async ({ page, api }) => {
    await api.entrarComo('pmo');
    api.forcarStatus = 503;
    await page.goto('/orcamento');
    await expect(page.getByRole('alert')).toContainText('O servidor teve um problema');
    api.forcarStatus = null;
    await page.getByRole('button', { name: 'Tentar novamente' }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
});
