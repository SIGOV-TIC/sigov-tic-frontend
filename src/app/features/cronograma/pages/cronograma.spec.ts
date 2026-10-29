import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Cronograma } from './cronograma';
import { dia, entrarComo, projeto, redesenhar, responderListagem } from '../../../testing/dados';
import { ProjetoResponse } from '../../projetos/models/projeto';

const atrasado = projeto({ id: 'b', sigla: 'ATR', nome: 'Atrasado', areaSolicitante: 'Infra', status: 'APROVADO' });
atrasado.fases![1].dataFim = '2026-06-15';
const lista: ProjetoResponse[] = [
  projeto({ id: 'a', sigla: 'ERP', nome: 'ERP "novo"', areaSolicitante: 'Sistemas', status: 'APROVADO' }),
  atrasado,
  projeto({ id: 'c', sigla: 'FUT', areaSolicitante: 'Sistemas', status: 'RASCUNHO', dataInicioPrevista: '2027-02-01', dataConclusaoPrevista: '2027-12-31',
    fases: [{ nome: 'Única', duracaoMeses: 10, situacao: 'PENDENTE' }] }),
  projeto({ id: 'd', sigla: 'SEM', areaSolicitante: 'Infra', dataInicioPrevista: undefined }),
];

async function abrir() {
  entrarComo('ESCRITORIO');
  TestBed.configureTestingModule({ imports: [Cronograma], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(Cronograma);
  const api = TestBed.inject(HttpTestingController);
  await fixture.whenStable();
  responderListagem(api, lista);
  await redesenhar(fixture);
  return { tela: fixture.componentInstance, el: fixture.nativeElement as HTMLElement, fixture };
}

describe('Cronograma', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(dia('2026-07-01'));
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('pior situação primeiro; projetos sem datas à parte', async () => {
    const { tela } = await abrir();
    expect(tela.linhas.map((l) => [l.projeto.sigla, l.estado])).toEqual([
      ['ATR', 'ATRASADO'],
      ['ERP', 'ANDAMENTO'],
      ['FUT', 'A_INICIAR'],
    ]);
    expect(tela.semCronograma.map((p) => p.sigla)).toEqual(['SEM']);
    expect(tela.resumoEstados.map((e) => `${e.rotulo}:${e.qtd}`)).toEqual(['Atrasados:1', 'Em andamento:1', 'A iniciar:1']);
  });

  it('opções de filtro saem dos dados', async () => {
    const { tela } = await abrir();
    expect(tela.areasDisponiveis).toEqual(['Infra', 'Sistemas']);
    expect(tela.anosDisponiveis).toEqual([2026, 2027, 2028]);
  });

  it('filtra por área e status; fim antes do início é corrigido', async () => {
    const { tela } = await abrir();
    tela.rascunho.area = 'Sistemas';
    tela.rascunho.status = 'APROVADO';
    tela.rascunho.anoFim = 2020;
    tela.filtrar();
    expect(tela.linhas.map((l) => l.projeto.sigla)).toEqual(['ERP']);
    expect(tela.filtros.anoFim).toBe(2026);
    expect(tela.filtrosAplicados.map((f) => f.valor)).toEqual(['Sistemas', 'Aprovado', '2026', 'Trimestre']);
    tela.limpar();
    expect(tela.linhas).toHaveLength(3);
  });

  it('linha do tempo em trimestres ou meses, com hoje marcado', async () => {
    const { tela } = await abrir();
    expect(tela.colunas.map((c) => c.rotulo).slice(0, 5)).toEqual(['T1', 'T2', 'T3', 'T4', 'T1']);
    expect(tela.anosColuna).toEqual([{ ano: 2026, colunas: 4 }, { ano: 2027, colunas: 4 }]);
    tela.alternarEscala('MES');
    expect(tela.colunas).toHaveLength(24);
    expect(tela.colunas[6].rotulo).toBe('jul');
    expect(tela.larguraLinhaTempo).toBe(24 * 48);
    expect(tela.posicaoHoje).toBeCloseTo(25, 0);
  });

  it('barra do projeto e avanço das fases', async () => {
    const { tela } = await abrir();
    const erp = tela.linhas.find((l) => l.projeto.sigla === 'ERP')!;
    expect(erp.avanco).toBe(50);
    expect(erp.barra!.esquerda).toBe(0);
    expect(erp.barra!.largura).toBeCloseTo(50, 0);
    expect(erp.fases.map((f) => f.avanco)).toEqual([100, 50, null]);
  });

  it('explica cada estado de fase', async () => {
    const { tela } = await abrir();
    const atr = tela.linhas[0];
    expect(tela.motivo(atr, atr.fases[1])).toBe('O prazo venceu em 15/06/2026 e a fase não foi concluída.');
    expect(tela.motivo(atr, atr.fases[0])).toBe('Fase concluída.');
    const fut = tela.linhas[2];
    expect(tela.motivo(fut, fut.fases[0])).toBe('Prevista para começar em 01/02/2027.');
    const erp = tela.linhas[1];
    expect(tela.motivo(erp, erp.fases[1])).toBe('Dentro do prazo, com término previsto em 30/09/2026.');
  });

  it('pagina os com e sem cronograma numa só sequência; impressão leva todos', async () => {
    const { tela } = await abrir();
    const muitas = tela.linhas.flatMap((l) => Array(6).fill(l));
    const p = tela.paginaDe(muitas, [lista[3]]);
    expect([p.total, p.linhas.length, p.sem.length]).toEqual([19, 15, 0]);
    tela.antesDeImprimir();
    expect(tela.paginaDe(muitas, [lista[3]]).linhas).toHaveLength(18);
    tela.depoisDeImprimir();
  });

  it('abre e fecha projetos e o detalhe da fase', async () => {
    const { tela } = await abrir();
    tela.alternarTodos();
    expect(tela.todosAbertos).toBe(true);
    tela.alternar('a');
    expect(tela.abertos.has('a')).toBe(false);
    tela.abrir(tela.linhas[0], tela.linhas[0].fases[1]);
    expect(tela.selecionado).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(tela.selecionado).toBeNull();
  });

  it('CSV com uma linha por projeto, aspas escapadas e separador ;', async () => {
    const { tela } = await abrir();
    let conteudo: Blob | null = null;
    let nome = '';
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => ((conteudo = b as Blob), 'blob:x'));
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      nome = this.download;
    });
    tela.exportar();
    const texto = await conteudo!.text();
    const linhas = texto.replace(/^﻿/, '').split('\r\n');
    expect(linhas).toHaveLength(5);
    expect(linhas[0]).toContain('"Sigla";"Projeto"');
    expect(linhas[1]).toContain('"ERP";"ERP ""novo"""');
    expect(linhas[1]).toContain('"Execução"');
    expect(linhas[4]).toContain('"Sem cronograma"');
    expect(nome).toMatch(/^SIGOV-TIC_Cronograma-Geral_2026-2027_\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
