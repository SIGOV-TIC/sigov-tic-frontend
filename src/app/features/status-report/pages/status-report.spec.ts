import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { StatusReport } from './status-report';
import { dia, entrarComo, projeto, redesenhar, responderListagem } from '../../../testing/dados';
import { Retrato } from '../models/retrato';

function completo() {
  const p = projeto({
    id: 'p1',
    sigla: 'ERP',
    atualizacoes: [
      { id: 'a1', data: '2026-07-10', texto: 'Dentro do mês', autor: 'Ana' },
      { id: 'a2', data: '2026-06-28', texto: 'Mês anterior' },
    ],
  });
  p.fases![1].atividades = [
    { id: 't1', titulo: 'Atrasada', prazo: '2026-07-05', situacao: 'EM_ANDAMENTO' },
    { id: 't2', titulo: 'Próxima', prazo: '2026-07-20', situacao: 'PENDENTE' },
    { id: 't3', titulo: 'Longe', prazo: '2026-09-01', situacao: 'PENDENTE' },
    { id: 't4', titulo: 'Feita', prazo: '2026-07-01', situacao: 'CONCLUIDA' },
  ];
  return p;
}

function retrato(extra: Partial<Retrato> = {}): Retrato {
  return {
    id: 'r1',
    projetoId: 'p1',
    sigla: 'ERP',
    area: 'TIC',
    gerente: 'Fernanda',
    periodoInicio: '2026-07-01',
    periodoFim: '2026-07-31',
    emitidoEm: '2026-07-16T09:30:00Z',
    autor: 'Pessoa do Escritório',
    andamento: '2026-07-10 · Ana: Homologação concluída.',
    pontoAtencao: 'Fornecedor atrasou.',
    recomendacao: 'Repactuar o cronograma.',
    fatos: [
      { metrica: 'PERCENTUAL_CONCLUIDO', valor: 40, meta: 55 },
      { metrica: 'PERCENTUAL_ESPERADO', valor: 55, meta: null },
      { metrica: 'IDP', valor: 0.72, meta: 1 },
      { metrica: 'IDC', valor: 1.1, meta: 1 },
      { metrica: 'FASES_CONCLUIDAS', valor: 1, meta: 3 },
      { metrica: 'FASES_TOTAL', valor: 3, meta: null },
      { metrica: 'ATIVIDADES_ABERTAS', valor: 5, meta: null },
      { metrica: 'ATIVIDADES_ATRASADAS', valor: 2, meta: 0 },
    ],
    ...extra,
  };
}

async function abrir(mes?: string, perfil: 'USER' | 'ESCRITORIO' = 'USER', retratos: Retrato[] = []) {
  entrarComo(perfil);
  TestBed.configureTestingModule({
    imports: [StatusReport],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(mes ? { mes } : {}) } } },
    ],
  });
  vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(StatusReport);
  const api = TestBed.inject(HttpTestingController);
  await fixture.whenStable();
  responderListagem(api, [projeto({ id: 'p2', sigla: 'ZZZ' }), projeto({ id: 'p1', sigla: 'ERP' })]);
  api.expectOne('/api/projetos/p1').flush(completo());
  await redesenhar(fixture);
  api.match((r) => r.url === '/api/retratos-mensais').forEach((r) => r.flush(retratos));
  await redesenhar(fixture);
  return { tela: fixture.componentInstance, el: fixture.nativeElement as HTMLElement, api, fixture };
}

describe('Status Report', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(dia('2026-07-12'));
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('oferece o mês atual e os onze anteriores, atravessando o ano', async () => {
    const { tela } = await abrir();
    expect(tela.periodos).toHaveLength(12);
    expect(tela.periodos.slice(0, 3).map((p) => p.rotulo)).toEqual(['julho de 2026', 'junho de 2026', 'maio de 2026']);
    expect(tela.periodos[11]).toEqual({ chave: '2025-08', ini: '2025-08-01', fim: '2025-08-31', rotulo: 'agosto de 2025' });
    expect(tela.periodo.chave).toBe('2026-07');
  });

  it('abre o primeiro projeto pela sigla, com as atualizações só do mês', async () => {
    const { tela, el } = await abrir();
    expect(tela.projetos.map((p) => p.sigla)).toEqual(['ERP', 'ZZZ']);
    expect(tela.atualizacoesDoPeriodo.map((a) => a.id)).toEqual(['a1']);
    expect(el.textContent).toContain('Dentro do mês');
    expect(el.textContent).not.toContain('Mês anterior');
  });

  it('atividades atrasadas e as que vencem nos 30 dias seguintes', async () => {
    const { tela } = await abrir();
    expect(tela.atrasadas.map((a) => a.atividade.titulo)).toEqual(['Atrasada']);
    expect(tela.proximas.map((a) => `${a.atividade.titulo}:${a.fase}`)).toEqual(['Próxima:Execução']);
  });

  it('mês passado usa o fim dele como referência', async () => {
    const { tela } = await abrir('2026-06');
    expect(tela.periodo.rotulo).toBe('junho de 2026');
    expect(tela.atualizacoesDoPeriodo.map((a) => a.id)).toEqual(['a2']);
    // Em 30/06 a de 05/07 ainda não tinha vencido; a de 20/07 cabe nos 30 dias seguintes.
    expect(tela.atrasadas).toHaveLength(0);
    expect(tela.proximas.map((a) => a.atividade.titulo)).toEqual(['Atrasada', 'Próxima']);
  });

  it('indicadores e formatação', async () => {
    const { tela } = await abrir();
    expect(tela.avanco).toBe(50);
    expect(tela.rotuloEstado).toBe('Em andamento');
    expect(tela.indice(1.234)).toBe('1,23');
    expect(tela.indice(null)).toBe('—');
    expect(tela.abaixo(0.85)).toBe(true);
    expect(tela.abaixo(0.95)).toBe(false);
  });

  describe('emitir e arquivar', () => {
    it('sem emissão o mês é prévia, calculada do projeto', async () => {
      const { tela, el } = await abrir();
      expect(tela.emitido).toBe(false);
      expect(el.textContent).toContain('Prévia · julho de 2026');
      expect(el.textContent).toContain('Situação em 12/07/2026');
      expect(tela.avanco).toBe(50);
    });

    it('o mês emitido mostra os valores congelados, não o projeto de hoje', async () => {
      const { tela, el } = await abrir(undefined, 'USER', [retrato()]);
      expect(tela.emitido).toBe(true);
      // O projeto está em 50%, mas o documento guardou 40%.
      expect(tela.avanco).toBe(40);
      expect(tela.esperado).toBe(55);
      expect(tela.indices).toEqual({ idp: 0.72, idc: 1.1 });
      expect(tela.pontoAtencao).toBe('Fornecedor atrasou.');
      expect(tela.recomendacao).toBe('Repactuar o cronograma.');
      expect(el.textContent).toContain('Emitido em 16/07/2026 por Pessoa do Escritório');
      expect(el.textContent).toContain('Homologação concluída.');
    });

    it('documento emitido traz as contagens congeladas no lugar das listas do projeto', async () => {
      const { tela, el } = await abrir(undefined, 'USER', [retrato()]);
      expect(tela.fasesConcluidas).toBe(1);
      expect(tela.fasesTotal).toBe(3);
      expect(tela.atividadesAtrasadas).toBe(2);
      expect(el.textContent).toContain('Fases concluídas');
      expect(el.textContent).not.toContain('Próximas entregas');
    });

    it('a lista de meses marca os que já têm documento', async () => {
      const { tela, el } = await abrir(undefined, 'USER', [retrato()]);
      expect(tela.foiEmitido(tela.periodos[0])).toBe(true);
      expect(tela.foiEmitido(tela.periodos[1])).toBe(false);
      expect(el.querySelector('select[ng-reflect-model], .filtro select')).toBeTruthy();
      expect(el.textContent).toContain('julho de 2026 · emitido');
    });

    it('retratos da época quinzenal valem no mês em que caíram; o último emitido é o documento', async () => {
      const primeira = retrato({ id: 'q1', periodoInicio: '2026-06-01', periodoFim: '2026-06-15', emitidoEm: '2026-06-16T09:00:00Z' });
      const segunda = retrato({
        id: 'q2', periodoInicio: '2026-06-16', periodoFim: '2026-06-30', emitidoEm: '2026-07-01T09:00:00Z',
        fatos: [{ metrica: 'PERCENTUAL_CONCLUIDO', valor: 33, meta: 45 }],
      });
      const { tela } = await abrir('2026-06', 'USER', [primeira, segunda]);
      expect(tela.foiEmitido(tela.periodo)).toBe(true);
      expect(tela.retrato?.id).toBe('q2');
      expect(tela.avanco).toBe(33);
      expect(tela.rotulosSerie).toEqual(['jun/26']);
    });

    it('quem só visualiza não vê o botão de emitir', async () => {
      const { tela, el } = await abrir();
      expect(tela.podeEmitir).toBe(false);
      expect(el.textContent).not.toContain('Emitir');
    });

    it('o Escritório vê o botão de emitir', async () => {
      const { tela, el } = await abrir(undefined, 'ESCRITORIO');
      expect(tela.podeEmitir).toBe(true);
      expect(el.textContent).toContain('Emitir');
    });

    it('emitir grava o mês e a tela passa a mostrar o documento', async () => {
      const { tela, el, api, fixture } = await abrir(undefined, 'ESCRITORIO');
      tela.emitir();
      const pedido = api.expectOne((r) => r.method === 'POST' && r.url === '/api/retratos-mensais');
      expect(pedido.request.params.get('projeto')).toBe('p1');
      expect(pedido.request.params.get('dia')).toBe('2026-07-01');
      pedido.flush(retrato());
      await redesenhar(fixture);

      expect(tela.emitido).toBe(true);
      expect(tela.emitindo).toBe(false);
      expect(el.textContent).toContain('Emitir novamente');
    });

    it('falha na emissão não deixa a tela travada', async () => {
      const { tela, api, fixture } = await abrir(undefined, 'ESCRITORIO');
      tela.emitir();
      api.expectOne((r) => r.method === 'POST').flush('', { status: 403, statusText: 'Forbidden' });
      await redesenhar(fixture);

      expect(tela.emitindo).toBe(false);
      expect(tela.erroEmissao).toBeTruthy();
      expect(tela.emitido).toBe(false);
    });

    it('um retrato só não vira gráfico de tendência', async () => {
      const { tela, el } = await abrir(undefined, 'USER', [retrato()]);
      expect(tela.temSerie).toBe(false);
      expect(el.textContent).not.toContain('Avanço acumulado');
    });

    it('dois meses emitidos viram série, na ordem do tempo', async () => {
      const anterior = retrato({
        id: 'r0',
        periodoInicio: '2026-06-01',
        periodoFim: '2026-06-30',
        emitidoEm: '2026-07-01T09:00:00Z',
        fatos: [
          { metrica: 'PERCENTUAL_CONCLUIDO', valor: 25, meta: 30 },
          { metrica: 'PERCENTUAL_ESPERADO', valor: 30, meta: null },
          { metrica: 'IDP', valor: 0.83, meta: 1 },
          { metrica: 'IDC', valor: 1.2, meta: 1 },
          { metrica: 'ORCADO', valor: 1000, meta: null },
          { metrica: 'REALIZADO', valor: 400, meta: 1000 },
        ],
      });
      const { tela, el } = await abrir(undefined, 'USER', [retrato(), anterior]);

      expect(tela.temSerie).toBe(true);
      expect(tela.rotulosSerie).toEqual(['jun/26', 'jul/26']);
      expect(tela.serieAvanco[0].valores).toEqual([25, 40]);
      expect(tela.serieAvanco[1].valores).toEqual([30, 55]);
      expect(tela.serieIndices.map((s) => s.valores)).toEqual([[0.83, 0.72], [1.2, 1.1]]);
      expect(tela.faixaIndices).toEqual({ de: 0.9, ate: 1.1 });
      expect(el.textContent).toContain('Avanço acumulado');
      expect(el.textContent).toContain('Desempenho de prazo e de custo');
    });

    it('a série para no mês escolhido: o relatório não mostra o futuro', async () => {
      const antiga = retrato({ id: 'r0', periodoInicio: '2026-06-01', emitidoEm: '2026-07-01T09:00:00Z' });
      const { tela } = await abrir('2026-06', 'USER', [retrato(), antiga]);
      expect(tela.rotulosSerie).toEqual(['jun/26']);
      expect(tela.temSerie).toBe(false);
    });

    it('sem custo realizado o gráfico de orçamento não aparece', async () => {
      const semCusto = (extra: object) =>
        retrato({ ...extra, fatos: [{ metrica: 'REALIZADO', valor: 0, meta: 1000 }] });
      const { tela } = await abrir(undefined, 'USER', [
        semCusto({}),
        semCusto({ id: 'r0', periodoInicio: '2026-06-01', emitidoEm: '2026-07-01T09:00:00Z' }),
      ]);
      expect(tela.temSerie).toBe(true);
      expect(tela.temOrcamento).toBe(false);
    });

    it('índice fora da faixa plausível acusa a linha de base, não a execução', async () => {
      const absurdo = retrato({
        fatos: [
          { metrica: 'IDP', valor: 7.5, meta: 1 },
          { metrica: 'IDC', valor: 1.1, meta: 1 },
        ],
      });
      const { tela, el } = await abrir(undefined, 'USER', [absurdo]);

      expect(tela.baseARevisar(7.5)).toBe(true);
      expect(tela.baseARevisar(1.1)).toBe(false);
      expect(tela.baseARevisar(0.4)).toBe(true);
      expect(tela.baseARevisar(null)).toBe(false);
      expect(tela.algumIndiceImplausivel).toBe(true);
      expect(el.textContent).toContain('linha de base a revisar');
      expect(el.textContent).toContain('Índice muito fora do plano');
    });

    it('meses com o mesmo avanço não viram gráfico de tendência', async () => {
      const parado = (extra: object) =>
        retrato({ ...extra, fatos: [{ metrica: 'PERCENTUAL_CONCLUIDO', valor: 40, meta: 55 }] });
      const { tela, el } = await abrir(undefined, 'USER', [
        parado({}),
        parado({ id: 'r0', periodoInicio: '2026-06-01', emitidoEm: '2026-07-01T09:00:00Z' }),
      ]);

      expect(tela.temSerie).toBe(true);
      expect(tela.serieSemVariacao).toBe(true);
      expect(el.textContent).toContain('Sem variação entre eles não há tendência');
      expect(el.textContent).not.toContain('Avanço acumulado');
    });

    it('mês sem nada registrado resolve em uma linha, não em três negativas', async () => {
      const vazio = retrato({ andamento: null, pontoAtencao: null, recomendacao: null });
      const { tela, el } = await abrir(undefined, 'USER', [vazio]);

      expect(tela.semNarrativa).toBe(true);
      expect(el.textContent).toContain('Sem registros no período.');
      expect(el.textContent).not.toContain('Nenhum ponto de atenção registrado.');
    });

    it('o documento tem identificador com projeto, mês e emissão', async () => {
      const { tela } = await abrir(undefined, 'USER', [retrato()]);
      expect(tela.identificador).toBe('ERP-202607-R1');
    });

    it('o cabeçalho de impressão leva projeto e mês para todas as páginas', async () => {
      const { tela } = await abrir(undefined, 'USER', [retrato()]);
      const css = tela.estiloDeImpressao();
      expect(css).toContain('@top-left');
      expect(css).toContain('Implantação do ERP');
      expect(css).toContain('Status Report · julho de 2026');
    });

    it('mês sem documento segue em prévia mesmo com outros emitidos', async () => {
      const { tela } = await abrir('2026-06', 'USER', [retrato()]);
      expect(tela.emitido).toBe(false);
      expect(tela.avanco).toBe(50);
    });
  });
});
