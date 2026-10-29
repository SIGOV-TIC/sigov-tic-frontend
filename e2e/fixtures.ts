import { test as base, expect } from '@playwright/test';
import { ApiFalsa } from './api-falsa';

// Cada teste ganha a API falsa instalada e falha se a página registrar erro no console.
export const test = base.extend<{ api: ApiFalsa; errosConsole: string[] }>({
  errosConsole: async ({ page }, use) => {
    const erros: string[] = [];
    page.on('pageerror', (e) => erros.push(e.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !/Failed to load resource/.test(msg.text())) erros.push(msg.text());
    });
    await use(erros);
    expect(erros, 'erros no console').toEqual([]);
  },
  api: async ({ page, errosConsole }, use) => {
    void errosConsole;
    const api = new ApiFalsa(page);
    await api.instalar();
    await use(api);
  },
});

export { expect };
