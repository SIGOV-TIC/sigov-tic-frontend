import { test, expect } from './fixtures';

const telas = [
  { link: 'Dashboard', titulo: /projetos|Dashboard/i, url: /\/dashboard/ },
  { link: 'Portfólio', titulo: /Portfólio/, url: /\/portfolio/ },
  { link: 'Cronograma', titulo: /Cronograma/, url: /\/cronograma/ },
  { link: 'Orçamento', titulo: /Orçamento/, url: /\/orcamento/ },
  { link: 'Objetivos', titulo: /Objetivos/, url: /\/objetivos/ },
];

test.describe('Navegação', () => {
  test('todas as telas do menu abrem sem erro', async ({ page, api }) => {
    await api.entrarComo('pmo');
    await page.goto('/dashboard');
    for (const t of telas) {
      await page.getByRole('navigation').getByRole('link', { name: t.link }).click();
      await expect(page).toHaveURL(t.url);
      await expect(page.locator('main')).toContainText(t.titulo);
    }
  });

  test('Dashboard aponta o projeto acima do orçado', async ({ page, api }) => {
    await api.entrarComo('diretoria');
    await page.goto('/dashboard');
    await expect(page.locator('main')).toContainText('Modernização da Rede');
  });

  test('Portfólio filtra pela busca e abre o projeto', async ({ page, api }) => {
    await api.entrarComo('diretoria');
    await page.goto('/portfolio');
    await page.getByPlaceholder(/Buscar/i).last().fill('rede');
    await expect(page.getByText('Implantação do ERP Corporativo')).toHaveCount(0);
    await page.getByText('Modernização da Rede').click();
    await expect(page).toHaveURL(/\/projeto\/p2/);
  });

  test('busca global (Ctrl+K) encontra o projeto pelo nome sem acento', async ({ page, api }) => {
    await api.entrarComo('diretoria');
    await page.goto('/dashboard');
    await page.keyboard.press('Control+k');
    await page.keyboard.type('modernizacao');
    await expect(page.locator('.busca-item.ativo')).toContainText('Modernização da Rede');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/projeto\/p2/);
  });

  test('feedback leva a tela atual', async ({ page, api }) => {
    await api.entrarComo('diretoria');
    await page.goto('/cronograma');
    await page.getByRole('button', { name: 'Feedback' }).click();
    await page.getByRole('dialog').locator('textarea').fill('Gostei do cronograma.');
    await page.getByRole('dialog').getByRole('button', { name: 'Enviar' }).click();
    await expect.poll(() => api.escritasEm('/api/feedback').length).toBe(1);
    expect(api.escritasEm('/api/feedback')[0].corpo).toMatchObject({ texto: 'Gostei do cronograma.', tela: '/cronograma' });
  });
});
