import { test, expect } from './fixtures';

test.describe('Cronograma', () => {
  test('arrastar a matriz rola na horizontal sem abrir o painel; clicar numa fase abre', async ({ page, api }) => {
    await api.entrarComo('pmo');
    await page.goto('/cronograma');
    const matriz = page.locator('.tl');
    await expect(matriz).toBeVisible();
    await page.getByRole('button', { name: /Abrir fases de/ }).first().click();
    const barra = page.locator('.tl-barra').first();
    await expect(barra).toBeVisible();

    const antes = await matriz.evaluate((el) => el.scrollLeft);
    const caixa = (await matriz.boundingBox())!;
    const y = caixa.y + 20;
    // Começa em cima de uma barra e termina em outro ponto: é arraste, não clique.
    const b = (await barra.boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + 120, y, { steps: 8 });
    await page.mouse.up();

    const depois = await matriz.evaluate((el) => el.scrollLeft);
    expect(depois).not.toBe(antes);
    await expect(page.locator('.painel')).toHaveCount(0);

    await barra.click();
    await expect(page.locator('.painel')).toBeVisible();
  });
});
