import { test, expect, Page } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';

// Campanha de uso: sete pessoas diferentes mexendo no sistema de verdade.
// Nada aqui é teste de regressão — é observação. Falha só quando o sistema
// faz algo que nenhum uso justifica (erro no console, tela em branco, 500).

const PASTA = new URL('./saida', import.meta.url).pathname;
mkdirSync(PASTA, { recursive: true });

type Achado = { persona: string; gravidade: 'quebra' | 'atrito' | 'nota'; onde: string; texto: string };
const achados: Achado[] = [];
const erros: string[] = [];

function achar(persona: string, gravidade: Achado['gravidade'], onde: string, texto: string) {
  achados.push({ persona, gravidade, onde, texto });
}

test.afterAll(() => {
  writeFileSync(`${PASTA}/achados.json`, JSON.stringify({ achados, erros }, null, 2));
});

async function entrar(page: Page, login: string) {
  page.on('pageerror', (e) => erros.push(`${login}: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) erros.push(`${login}: ${m.text()}`);
  });
  await page.goto('/login');
  await page.locator('#usuario').fill(login);
  await page.locator('#senha').fill('sigov123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

// O rótulo exato da opção do projeto, achado pela sigla.
async function rotuloCom(page: Page, sigla: string): Promise<string> {
  const select = page.locator('.filtro select').first();
  await expect.poll(async () => select.locator('option').count(), { timeout: 15_000 }).toBeGreaterThan(1);
  const opcoes = await select.locator('option').allInnerTexts();
  const achado = opcoes.find((o) => o.trim().startsWith(sigla + ' '));
  if (!achado) throw new Error(`projeto ${sigla} não está na lista: ${opcoes.join(' | ')}`);
  return achado;
}

const foto = (page: Page, nome: string) => page.screenshot({ path: `${PASTA}/${nome}.png`, fullPage: true });

// Cada tela tem que sobreviver a ser aberta: nada de branco, nada de erro.
async function telaViva(page: Page, persona: string, onde: string) {
  const corpo = (await page.locator('app-root').innerText()).trim();
  if (corpo.length < 40) achar(persona, 'quebra', onde, 'A tela abriu praticamente vazia.');
}



// ---------------------------------------------------------------------------
// 1. Cláudia Moraes · Escritório de Projetos · PMP, 15 anos de casa.
//    Devagar, confere número contra número, não aceita gráfico sem tabela.
// ---------------------------------------------------------------------------
test('Cláudia confere tudo duas vezes antes de emitir', async ({ page }) => {
  const eu = 'Cláudia · Escritório, meticulosa';
  await entrar(page, 'claudia.pmo');

  await page.goto('/portfolio');
  await telaViva(page, eu, 'Portfólio');
  await expect(page.getByText('PUSC')).toBeVisible();

  // Ela começa pelo projeto que sabe que está ruim.
  await page.goto('/status-report');
  await page.locator('.filtro select').first().selectOption({ label: await rotuloCom(page, 'SLC') });
  await page.locator('.rel-tipo').waitFor();
  const tipo = await page.locator('.rel-tipo').innerText();
  achar(eu, 'nota', 'Status Report', `Abriu o SLC em "${tipo}".`);

  // Confere o avanço do cabeçalho contra o último ponto do gráfico.
  const avanco = await page.locator('.rel-indicadores b').nth(1).innerText();
  const grafico = page.locator('app-grafico-tendencia').first();
  const pontaGrafico = (await grafico.locator('.rotulo-ponta').first().textContent()) ?? '';
  if (avanco.trim() !== pontaGrafico.trim()) {
    achar(eu, 'atrito', 'Status Report', `Cabeçalho diz ${avanco} e a ponta do gráfico diz ${pontaGrafico}.`);
  }

  // E o gráfico contra a tabela.
  await grafico.getByRole('button', { name: 'Ver os dados' }).click();
  const ultimaLinha = (await grafico.locator('tbody tr').last().textContent()) ?? '';
  if (!ultimaLinha.includes(pontaGrafico.trim())) {
    achar(eu, 'quebra', 'Gráfico', `A tabela não traz o valor da ponta (${pontaGrafico}): "${ultimaLinha}".`);
  }
  await grafico.getByRole('button', { name: 'Ver o gráfico' }).click();

  // Emite a quinzena corrente e confere que o documento assume.
  const botao = page.getByRole('button', { name: /^Emitir$/ });
  if (await botao.isVisible()) {
    await botao.click();
    await expect(page.locator('.rel-tipo')).toContainText('Status Report', { timeout: 15_000 });
    await expect(page.getByText(/Emitido em .* por Cláudia Moraes/)).toBeVisible();
  } else {
    achar(eu, 'nota', 'Status Report', 'A quinzena corrente já estava emitida.');
  }

  // O número do relatório tem que aparecer igual na central de dados.
  await page.goto('/dados');
  await page.locator('.filtro select').first().selectOption({ label: await rotuloCom(page, 'SLC') });
  await page.getByRole('button', { name: 'Avanço concluído' }).click();
  await page.waitForResponse((r) => r.url().includes('/fatos') && r.status() === 200);
  await page.waitForTimeout(500);
  const linhas = await page.locator('tbody tr').allInnerTexts();
  if (!linhas.some((l) => l.includes(avanco.trim()))) {
    achar(eu, 'atrito', 'Dados', `O avanço ${avanco} do relatório não aparece na central para o SLC.`);
  }
  await foto(page, '1-claudia-dados');
});

// ---------------------------------------------------------------------------
// 2. Diego Tavares · PO · faz tudo entre duas reuniões, no susto.
//    Clica duas vezes, aperta Enter, sai da tela antes de salvar.
// ---------------------------------------------------------------------------
test('Diego atropela o sistema em dois minutos', async ({ page }) => {
  const eu = 'Diego · PO, apressado';
  await entrar(page, 'diego.po');

  await page.goto('/portfolio');
  await page.getByText('PUSC').first().click();
  await telaViva(page, eu, 'Projeto');

  // Duplo clique em tudo que parece clicável.
  const editar = page.getByRole('button', { name: /^Editar / }).first();
  if (await editar.count()) {
    await editar.dblclick();
    const campos = await page.locator('textarea.campo-edicao').count();
    if (campos > 1) achar(eu, 'quebra', 'Projeto', `Duplo clique abriu ${campos} editores ao mesmo tempo.`);
    const campo = page.locator('textarea.campo-edicao').first();
    if (await campo.count()) {
      // Salva vazio: o sistema aceita apagar o conteúdo sem avisar?
      await campo.fill('');
      await page.getByRole('button', { name: 'Salvar' }).first().click();
      await page.waitForTimeout(800);
      achar(eu, 'nota', 'Projeto', 'Salvou o campo vazio sem pedir confirmação.');
    }
  }

  // Abre uma fase e sai no meio com Esc, depois volta.
  const fase = page.locator('.cf-fase, .fase-cartao, [class*="fase"]').first();
  if (await fase.count()) {
    await fase.click({ trial: true }).catch(() => {});
  }

  // Vai para o Status Report e espeta o botão de emitir duas vezes.
  await page.goto('/status-report');
  await page.locator('.rel-tipo').waitFor();
  const emitir = page.getByRole('button', { name: /Emitir/ });
  if (await emitir.count()) {
    achar(eu, 'quebra', 'Status Report', 'O PO vê o botão de emitir, que deveria ser só do Escritório.');
  } else {
    achar(eu, 'nota', 'Status Report', 'Sem botão de emitir para o PO, como esperado.');
  }

  // Sai da tela no meio do carregamento.
  await page.goto('/dados');
  await page.goto('/cronograma');
  await page.goto('/dashboard');
  await telaViva(page, eu, 'Dashboard depois de trocar de tela três vezes seguidas');
  await foto(page, '2-diego-dashboard');
});

// ---------------------------------------------------------------------------
// 3. Simone Rocha · gerência · não confia em gráfico, quer o número.
//    Vai direto aos dados brutos, filtra, baixa, confere.
// ---------------------------------------------------------------------------
test('Simone só acredita no que ela mesma somar', async ({ page }) => {
  const eu = 'Simone · gerência, cética';
  await entrar(page, 'simone.gerente');

  await page.goto('/dados');
  await page.locator('tbody tr').first().waitFor();
  const totalInicial = await page.locator('.resumo').innerText();
  achar(eu, 'nota', 'Dados', `Abre em "${totalInicial.replace(/\s+/g, ' ').trim()}".`);

  // Filtra por área.
  const areas = await page.locator('.filtro select').nth(1).locator('option').allInnerTexts();
  achar(eu, 'nota', 'Dados', `Áreas oferecidas: ${areas.join(' | ')}.`);
  await page.locator('.filtro select').nth(1).selectOption({ index: 1 });
  await page.waitForTimeout(600);
  await telaViva(page, eu, 'Dados com filtro de área');

  // Período invertido: começa depois de terminar.
  await page.locator('.filtro select').nth(1).selectOption('');
  await page.locator('input[type="date"]').first().fill('2030-01-01');
  await page.locator('input[type="date"]').nth(1).fill('2020-01-01');
  await page.waitForTimeout(800);
  const vazio = await page.locator('app-estado').count();
  achar(eu, vazio ? 'nota' : 'atrito', 'Dados',
    vazio ? 'Período invertido cai na tela de vazio, sem erro.' : 'Período invertido não avisa nada.');
  const csvDesligado = await page.getByRole('button', { name: 'Baixar CSV' }).isDisabled();
  if (!csvDesligado) achar(eu, 'atrito', 'Dados', 'Dá para baixar CSV de um recorte sem nenhuma linha.');

  // Volta ao recorte cheio e baixa o arquivo.
  await page.getByRole('button', { name: 'Limpar' }).click();
  await page.locator('tbody tr').first().waitFor();
  const baixa = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar CSV' }).click();
  const arquivo = await baixa;
  const destino = `${PASTA}/simone.csv`;
  await arquivo.saveAs(destino);
  const { readFileSync } = await import('node:fs');
  const csv = readFileSync(destino, 'utf8');
  const linhasCsv = csv.trim().split('\n');
  achar(eu, 'nota', 'CSV', `Arquivo "${arquivo.suggestedFilename()}" com ${linhasCsv.length - 1} linhas.`);
  if (!linhasCsv[0].startsWith('projeto_id,sigla,area')) {
    achar(eu, 'quebra', 'CSV', `Cabeçalho inesperado: ${linhasCsv[0]}`);
  }
  // Número cru nas colunas de valor: só dígitos, sinal e ponto decimal.
  const colunasRuins = linhasCsv.slice(1)
    .map((l) => l.split(','))
    .filter((c) => c.length >= 10 && ![c[8], c[9]].every((v) => /^-?\d*(\.\d+)?$/.test(v)));
  if (colunasRuins.length) {
    achar(eu, 'quebra', 'CSV', `Valor formatado em vez de cru: ${colunasRuins[0].slice(7).join(',')}`);
  }
  const naTela = Number((await page.locator('.resumo').innerText()).match(/(\d+)\s+linhas?/)?.[1] ?? '0');
  if (naTela !== linhasCsv.length - 1) {
    achar(eu, 'atrito', 'CSV', `Tela mostra ${naTela} linhas e o arquivo tem ${linhasCsv.length - 1}.`);
  }
  await foto(page, '3-simone-dados');
});

// ---------------------------------------------------------------------------
// 4. Wagner Lima · Scrum Master há três meses · não sabe o que é IDP.
//    Tenta fazer coisas que não pode e precisa entender a recusa.
// ---------------------------------------------------------------------------
test('Wagner esbarra em tudo que não é dele', async ({ page }) => {
  const eu = 'Wagner · Scrum Master novato';
  await entrar(page, 'wagner.sm');

  await page.goto('/dashboard');
  await telaViva(page, eu, 'Dashboard');

  // Procura "Novo Projeto" no menu.
  const novo = page.getByRole('link', { name: 'Novo Projeto' });
  achar(eu, 'nota', 'Menu', (await novo.count()) ? 'Vê "Novo Projeto" no menu.' : 'Não vê "Novo Projeto" no menu.');

  // Tenta pela URL mesmo assim.
  await page.goto('/cadastro');
  await page.waitForTimeout(800);
  achar(eu, 'nota', 'Cadastro por URL', `Foi parar em ${new URL(page.url()).pathname}.`);
  await telaViva(page, eu, 'Depois de tentar /cadastro');

  // Abre um projeto que não é dele e tenta editar.
  await page.goto('/portfolio');
  await page.getByText('OBS').first().click();
  await page.waitForTimeout(600);
  const editaveis = await page.getByRole('button', { name: /^Editar / }).count();
  achar(eu, 'nota', 'Projeto alheio', `Encontra ${editaveis} campos editáveis num projeto em que não está vinculado.`);

  // Procura o que significa IDP em algum lugar da tela.
  await page.goto('/status-report');
  await page.locator('.rel-tipo').waitFor();
  const textoTela = await page.locator('app-root').innerText();
  const dicas = await page.locator('.rel-indicadores small[title]').evaluateAll((els) => els.map((e) => e.getAttribute('title') ?? ''));
  const temExplicacao = /índice de desempenho/i.test(textoTela + dicas.join(' '));
  achar(eu, temExplicacao ? 'nota' : 'atrito', 'Status Report',
    temExplicacao ? `Achou o nome por extenso na dica do indicador: "${dicas[0]?.slice(0, 60)}…"` : 'IDP e IDC aparecem sem nada que diga o que são.');
  await foto(page, '4-wagner-status');
});

// ---------------------------------------------------------------------------
// 5. Heloísa Pires · diretoria · quarenta segundos, depois imprime.
// ---------------------------------------------------------------------------
test('Heloísa olha por quarenta segundos e manda imprimir', async ({ page }) => {
  const eu = 'Heloísa · diretoria, de passagem';
  await entrar(page, 'heloisa.diretoria');

  await page.goto('/dashboard');
  await telaViva(page, eu, 'Dashboard');
  await foto(page, '5-heloisa-dashboard');

  await page.goto('/status-report');
  await page.locator('.rel-tipo').waitFor();
  const podeEmitir = await page.getByRole('button', { name: /Emitir/ }).count();
  if (podeEmitir) achar(eu, 'quebra', 'Status Report', 'Visualizador vê o botão de emitir.');

  // O PDF precisa se explicar sozinho: ela manda por e-mail sem escrever nada.
  await page.emulateMedia({ media: 'print' });
  const impresso = await page.locator('app-root').innerText();
  for (const obrigatorio of ['Relatório de Acompanhamento de Projeto', 'Período', 'Emitido por', 'Gerente do projeto']) {
    if (!impresso.toLowerCase().includes(obrigatorio.toLowerCase())) achar(eu, 'quebra', 'PDF', `Falta "${obrigatorio}" no documento impresso.`);
  }
  await page.pdf({ path: `${PASTA}/5-heloisa-relatorio.pdf`, printBackground: true, preferCSSPageSize: true });
  await page.emulateMedia({ media: 'screen' });
});

// ---------------------------------------------------------------------------
// 6. Rogério Nunes · analista que gosta de quebrar · mexe na URL.
// ---------------------------------------------------------------------------
test('Rogério tenta quebrar pela URL e pelos casos torcidos', async ({ page }) => {
  const eu = 'Rogério · analista adversarial';
  await entrar(page, 'rogerio.analista');

  const rotas: [string, string][] = [
    ['/status-report?projeto=00000000-0000-0000-0000-000000000000', 'Status Report com projeto inexistente'],
    ['/status-report?quinzena=banana', 'Status Report com quinzena inválida'],
    ['/dados?pagina=99999', 'Dados na página 99999'],
    ['/dados?metrica=NAO_EXISTE', 'Dados com métrica inventada'],
    ['/dados?de=xx&ate=yy', 'Dados com datas inválidas'],
    ['/projeto/00000000-0000-0000-0000-000000000000', 'Projeto inexistente'],
  ];
  for (const [rota, onde] of rotas) {
    await page.goto(rota);
    await page.waitForTimeout(900);
    await telaViva(page, eu, onde);
    const texto = await page.locator('app-root').innerText();
    if (/undefined|NaN|\[object Object\]|Internal Server Error/i.test(texto)) {
      achar(eu, 'quebra', onde, 'A tela mostra lixo técnico para o usuário.');
    }
  }

  // Projeto sem fases e sem orçamento.
  await page.goto('/status-report');
  await page.locator('.filtro select').first().selectOption({ label: await rotuloCom(page, 'DMC') });
  await page.locator('.rel-tipo').waitFor();
  const dmc = await page.locator('app-root').innerText();
  achar(eu, 'nota', 'Projeto sem fases (DMC)',
    `Avanço mostrado: ${dmc.match(/Concluído\s+(\S+)/)?.[1] ?? '?'}; índices: ${dmc.match(/IDP · prazo\s+(\S+)/)?.[1] ?? '?'} / ${dmc.match(/IDC · custo\s+(\S+)/)?.[1] ?? '?'}.`);
  await foto(page, '6-rogerio-sem-fases');

  // Projeto que ainda não começou.
  await page.locator('.filtro select').first().selectOption({ label: await rotuloCom(page, 'DMESH') });
  await page.waitForTimeout(600);
  const futuro = await page.locator('app-root').innerText();
  achar(eu, 'nota', 'Projeto que começa no futuro (DMESH)',
    `Esperado pelo prazo: ${futuro.match(/esperado pelo prazo:\s*(\S+)/)?.[1] ?? '—'}; IDP: ${futuro.match(/IDP · prazo\s+(\S+)/)?.[1] ?? '?'}.`);

  // Nome gigante com acento e símbolo.
  await page.locator('.filtro select').first().selectOption({ label: await rotuloCom(page, 'PMIRSACRC') });
  await page.waitForTimeout(600);
  const larguraTexto = await page.locator('.rel-topo h2').boundingBox();
  const larguraCartao = await page.locator('.relatorio').boundingBox();
  if (larguraTexto && larguraCartao && larguraTexto.width > larguraCartao.width) {
    achar(eu, 'quebra', 'Nome gigante', 'O título do projeto estoura a largura do relatório.');
  }
  const rolagem = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  if (rolagem) achar(eu, 'atrito', 'Nome gigante', 'A página ganhou rolagem horizontal.');
  await foto(page, '6-rogerio-nome-gigante');
});

// ---------------------------------------------------------------------------
// 7. Dois ao mesmo tempo: o PO mexe enquanto o Escritório emite.
// ---------------------------------------------------------------------------
test('PO e Escritório mexem no mesmo projeto ao mesmo tempo', async ({ browser }) => {
  const eu = 'Dois ao mesmo tempo';
  const abaPmo = await (await browser.newContext()).newPage();
  const abaPo = await (await browser.newContext()).newPage();
  await entrar(abaPmo, 'claudia.pmo');
  await entrar(abaPo, 'diego.po');

  // O Escritório abre o relatório do PUSC e emite.
  await abaPmo.goto('/status-report');
  await abaPmo.locator('.filtro select').first().selectOption({ label: await rotuloCom(abaPmo, 'PUSC') });
  await abaPmo.locator('.rel-tipo').waitFor();
  const emitir = abaPmo.getByRole('button', { name: /^Emitir/ });
  await emitir.click();
  await abaPmo.waitForTimeout(1500);
  const avancoNoDocumento = await abaPmo.locator('.rel-indicadores b').nth(1).innerText();

  // Enquanto isso o PO empurra o percentual da fase para cima.
  await abaPo.goto('/portfolio');
  await abaPo.getByText('PUSC').first().click();
  await abaPo.waitForTimeout(800);
  achar(eu, 'nota', 'Concorrência', `Documento emitido com avanço ${avancoNoDocumento}.`);

  // O Escritório recarrega: o documento não pode ter mudado sozinho.
  await abaPmo.reload();
  await abaPmo.locator('.rel-tipo').waitFor();
  const depois = await abaPmo.locator('.rel-indicadores b').nth(1).innerText();
  if (depois !== avancoNoDocumento) {
    achar(eu, 'quebra', 'Concorrência', `O documento emitido mudou de ${avancoNoDocumento} para ${depois} depois de recarregar.`);
  }
  await foto(abaPmo, '7-concorrencia');
});
