import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { Dados } from './dados';
import { entrarComo, projeto, redesenhar, responderListagem } from '../../../testing/dados';
import { LinhaFato, Metrica } from '../../status-report/models/retrato';

function linha(metrica: Metrica, valor: number, extra: Partial<LinhaFato> = {}): LinhaFato {
  return {
    projetoId: 'p1',
    sigla: 'ERP',
    area: 'DTI',
    gerente: 'Cláudio',
    quinzenaInicio: '2026-07-01',
    quinzenaFim: '2026-07-15',
    emitidoEm: '2026-07-16T09:00:00Z',
    metrica,
    valor,
    meta: null,
    ...extra,
  };
}

const FATOS = [
  linha('PERCENTUAL_CONCLUIDO', 40, { meta: 55 }),
  linha('IDP', 0.72, { meta: 1 }),
  linha('REALIZADO', 780000, { meta: 1500000 }),
  linha('PERCENTUAL_CONCLUIDO', 25, { projetoId: 'p2', sigla: 'PSD', quinzenaInicio: '2026-06-16', quinzenaFim: '2026-06-30' }),
];

async function abrir(consulta: Record<string, string | string[]> = {}, fatos = FATOS) {
  entrarComo('ESCRITORIO');
  TestBed.configureTestingModule({
    imports: [Dados],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(consulta) }, queryParamMap: { pipe: () => ({ subscribe: () => ({ unsubscribe() {} }) }) } } },
    ],
  });
  const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(Dados);
  const api = TestBed.inject(HttpTestingController);
  await fixture.whenStable();
  responderListagem(api, [projeto({ id: 'p1', sigla: 'ERP' })]);
  api.match('/api/retratos-quinzenais/areas').forEach((r) => r.flush(['DTI', 'Sistemas']));
  const pedido = api.match((r) => r.url === '/api/retratos-quinzenais/fatos')[0];
  pedido.flush(fatos);
  await redesenhar(fixture);
  return { tela: fixture.componentInstance, el: fixture.nativeElement as HTMLElement, api, fixture, navegar, pedido };
}

describe('Dados', () => {
  afterEach(() => localStorage.clear());

  it('mostra uma linha por fato e resume o recorte', async () => {
    const { tela, el } = await abrir();
    expect(tela.total).toBe(4);
    expect(tela.projetosNaTabela).toBe(2);
    expect(tela.quinzenas).toBe(2);
    expect(el.querySelectorAll('tbody tr')).toHaveLength(4);
    expect(el.textContent?.replace(/\s+/g, ' ')).toContain('4 linhas · 2 projetos · 2 quinzenas');
  });

  it('cada métrica se lê na sua unidade', async () => {
    const { tela } = await abrir();
    expect(tela.valor(FATOS[0])).toBe('40%');
    expect(tela.meta(FATOS[0])).toBe('55%');
    expect(tela.valor(FATOS[1])).toBe('0,72');
    expect(tela.valor(FATOS[2])).toContain('780.000');
    expect(tela.quinzena(FATOS[0])).toBe('01 a 15/07/2026');
  });

  it('o recorte da URL vai para o pedido', async () => {
    const { pedido } = await abrir({ projeto: 'p1', area: 'DTI', de: '2026-01-01', metrica: ['IDP', 'IDC'] });
    expect(pedido.request.params.get('projeto')).toBe('p1');
    expect(pedido.request.params.get('area')).toBe('DTI');
    expect(pedido.request.params.get('de')).toBe('2026-01-01');
    expect(pedido.request.params.getAll('metrica')).toEqual(['IDP', 'IDC']);
  });

  it('marcar uma métrica refaz a busca e grava na URL', async () => {
    const { tela, api, navegar, fixture } = await abrir();
    tela.alternarMetrica('IDP');
    await redesenhar(fixture);

    const novo = api.match((r) => r.url === '/api/retratos-quinzenais/fatos')[0];
    expect(novo.request.params.getAll('metrica')).toEqual(['IDP']);
    expect(navegar.mock.calls.at(-1)?.[1]?.queryParams).toMatchObject({ metrica: ['IDP'] });
    novo.flush([FATOS[1]]);

    tela.alternarMetrica('IDP');
    expect(tela.marcada('IDP')).toBe(false);
  });

  it('limpar tira todos os filtros', async () => {
    const { tela, api } = await abrir({ projeto: 'p1', metrica: ['IDP'] });
    expect(tela.temFiltro).toBe(true);
    tela.limpar();

    expect(tela.temFiltro).toBe(false);
    const novo = api.match((r) => r.url === '/api/retratos-quinzenais/fatos')[0];
    expect(novo.request.params.keys()).toHaveLength(0);
  });

  it('o CSV sai com o mesmo recorte da tabela', async () => {
    const { tela, api } = await abrir({ area: 'DTI' });
    const clique = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:csv');
    globalThis.URL.revokeObjectURL = vi.fn();

    tela.baixarCsv();
    const pedido = api.expectOne((r) => r.url === '/api/retratos-quinzenais/fatos.csv');
    expect(pedido.request.params.get('area')).toBe('DTI');
    expect(pedido.request.responseType).toBe('blob');
    pedido.flush(new Blob(['projeto_id,sigla\n']));

    expect(clique).toHaveBeenCalled();
    expect(tela.baixando).toBe(false);
    clique.mockRestore();
  });

  it('erro na busca não deixa a tabela com dado velho', async () => {
    const { tela, api, fixture } = await abrir();
    tela.buscar();
    api.match((r) => r.url === '/api/retratos-quinzenais/fatos')[0].flush('', { status: 500, statusText: 'Erro' });
    await redesenhar(fixture);

    expect(tela.linhas).toEqual([]);
    expect(tela.erro).toBeTruthy();
  });
});
