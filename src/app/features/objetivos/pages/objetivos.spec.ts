import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Objetivos } from './objetivos';
import { dia, entrarComo, meta, projeto, redesenhar, responderListagem } from '../../../testing/dados';

const projetos = [
  projeto({ id: 'p1', sigla: 'ERP', objetivoEstrategico: 'OE1' }),
  projeto({ id: 'p2', sigla: 'NET', objetivoEstrategico: 'OE2' }),
  projeto({ id: 'p3', sigla: 'SEM', objetivoEstrategico: '  ' }),
  projeto({ id: 'p4', sigla: 'REJ', objetivoEstrategico: 'OE2', status: 'REJEITADO' }),
];
const metas = [
  meta({ id: 'm1', objetivo: 'OE1', indicador: 'No ritmo', valorAtual: 50 }),
  meta({ id: 'm2', objetivo: 'OE1', indicador: 'Atrás', valorAtual: 10 }),
  meta({ id: 'm3', objetivo: 'OE3', indicador: 'Sem medição', valorAtual: null }),
];

async function abrir(perfil: 'ESCRITORIO' | 'USER' = 'ESCRITORIO', abrirObjetivo?: string) {
  entrarComo(perfil);
  TestBed.configureTestingModule({
    imports: [Objetivos],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(abrirObjetivo ? { abrir: abrirObjetivo } : {}) } } },
    ],
  });
  const fixture = TestBed.createComponent(Objetivos);
  const api = TestBed.inject(HttpTestingController);
  await fixture.whenStable();
  responderListagem(api, projetos);
  api.expectOne('/api/metas').flush(metas);
  await redesenhar(fixture);
  return { tela: fixture.componentInstance, api, el: fixture.nativeElement as HTMLElement };
}

describe('Objetivos', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(dia('2026-07-01'));
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('agrupa metas e projetos por objetivo, pior primeiro e sem objetivo no fim', async () => {
    const { tela } = await abrir();
    const os = tela.objetivos;
    expect(os.map((o) => [o.titulo, o.estado])).toEqual([
      ['OE1', 'RISCO'],
      ['OE2', 'ANDAMENTO'],
      ['OE3', 'A_INICIAR'],
      ['Sem objetivo estratégico definido', 'ANDAMENTO'],
    ]);
    expect(os[1].projetos.map((p) => p.projeto.sigla)).toEqual(['NET']);
  });

  it('progresso vem das metas medidas; sem metas, do avanço dos projetos', async () => {
    const { tela } = await abrir();
    const [oe1, oe2, oe3] = tela.objetivos;
    expect([oe1.progresso, oe1.porMetas]).toEqual([30, true]);
    expect([oe2.progresso, oe2.porMetas]).toEqual([50, false]);
    expect([oe3.progresso, oe3.porMetas]).toEqual([0, false]);
  });

  it('resumo e objetivos fora do previsto já abertos', async () => {
    const { tela } = await abrir();
    expect(tela.totalMetas).toBe(3);
    expect(tela.metasForaDoPrevisto).toBe(1);
    expect(tela.totalProjetos).toBe(3);
    expect([...tela.abertos]).toEqual(['OE1']);
  });

  it('link da busca abre o objetivo pedido', async () => {
    const { tela } = await abrir('USER', 'OE3');
    expect(tela.abertos.has('OE3')).toBe(true);
  });

  describe('edição de meta', () => {
    it('exige os campos e alvo diferente do inicial', async () => {
      const { tela, api } = await abrir();
      tela.novaMeta('OE1');
      tela.salvar();
      expect(tela.erroEdicao).toBe('Preencha objetivo, indicador, valores inicial e alvo e prazo.');
      tela.edicao!.indicador = 'Novo';
      tela.edicao!.valorAlvo = 0;
      tela.salvar();
      expect(tela.erroEdicao).toBe('O alvo precisa ser diferente do valor inicial.');
      api.expectNone('/api/metas');
    });

    it('cria convertendo os números e abre o objetivo', async () => {
      const { tela, api } = await abrir();
      tela.novaMeta('OE4');
      Object.assign(tela.edicao!, { indicador: 'Serviços', valorAlvo: '80', valorAtual: '' });
      tela.salvar();
      const req = api.expectOne('/api/metas');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toMatchObject({ objetivo: 'OE4', valorInicial: 0, valorAlvo: 80, valorAtual: null, prazo: '2026-12-31' });
      req.flush(meta({ id: 'm9', objetivo: 'OE4' }));
      expect(tela.metas).toHaveLength(4);
      expect(tela.abertos.has('OE4')).toBe(true);
    });

    it('edita e exclui com confirmação', async () => {
      const { tela, api } = await abrir();
      tela.editar(metas[1]);
      tela.edicao!.valorAtual = 30;
      tela.salvar();
      const put = api.expectOne('/api/metas/m2');
      expect(put.request.method).toBe('PUT');
      put.flush({ ...metas[1], valorAtual: 30 });

      vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
      tela.editar(metas[0]);
      tela.excluir();
      api.expectNone('/api/metas/m1');
      tela.excluir();
      api.expectOne('/api/metas/m1').flush(null);
      expect(tela.metas.map((m) => m.id)).toEqual(['m2', 'm3']);
    });
  });

  it('visualizador não vê os botões de meta', async () => {
    const { el } = await abrir('USER');
    expect(el.textContent).not.toContain('Nova meta');
  });
});
