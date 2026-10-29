import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Dashboard } from './dashboard';
import { dia, entrarComo, meta, projeto, redesenhar, responderListagem } from '../../../testing/dados';
import { ProjetoResponse } from '../../projetos/models/projeto';

function comFase2(extra: Partial<ProjetoResponse>, f2: object) {
  const p = projeto(extra);
  Object.assign(p.fases![1], f2);
  return p;
}

const projetos = [
  projeto({ id: 'a', sigla: 'OK', nome: 'No ritmo' }),
  // Execução venceu em 15/06 sem concluir; gastou além do orçado.
  comFase2({ id: 'b', sigla: 'ATR', nome: 'Atrasado', orcamentoEstimado: 200_000, custoRealizado: 250_000, gerenteResponsavel: 'Cláudio' }, { dataFim: '2026-06-15' }),
  // Execução com 10% e vence em 10/07; gasto à frente do avanço.
  comFase2({ id: 'c', sigla: 'RIS', nome: 'Em risco', orcamentoEstimado: 100_000, custoRealizado: 80_000 }, { percentual: 10, dataFim: '2026-07-10' }),
  projeto({ id: 'd', sigla: 'REJ', status: 'REJEITADO' }),
];

const metas = [
  meta({ id: 'm1', indicador: 'No ritmo' }),
  meta({ id: 'm2', indicador: 'Atrás', valorAtual: 10 }),
  meta({ id: 'm3', indicador: 'Vencida', prazo: '2026-06-30' }),
  meta({ id: 'm4', indicador: 'Vence logo', prazo: '2026-07-20', valorAtual: 90 }),
];

async function abrir() {
  entrarComo('USER');
  TestBed.configureTestingModule({ imports: [Dashboard], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(Dashboard);
  const api = TestBed.inject(HttpTestingController);
  await fixture.whenStable();
  responderListagem(api, projetos);
  api.expectOne('/api/metas').flush(metas);
  await redesenhar(fixture);
  return { tela: fixture.componentInstance, api, el: fixture.nativeElement as HTMLElement };
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(dia('2026-07-01'));
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('faixa do topo: contagens e gravidade, sem os projetos rejeitados', async () => {
    const { tela } = await abrir();
    expect(tela.indicadores.map((i) => [i.nome, i.valor, i.gravidade])).toEqual([
      ['Projetos', 3, null],
      ['Prazo', 1, 'grave'],
      ['Custo', 1, 'grave'],
      ['Metas', 2, 'grave'],
    ]);
    expect(tela.indicadores[1].sub).toBe('1 em risco · de 3 projetos');
  });

  it('lista de atenção: graves primeiro, depois prazo, custo e meta', async () => {
    const { tela } = await abrir();
    expect(tela.alertas.map((a) => `${a.gravidade}:${a.tipo}:${a.sigla ?? a.titulo}`)).toEqual([
      'grave:Prazo:ATR',
      'grave:Custo:ATR',
      'grave:Meta:Vencida',
      'atencao:Prazo:RIS',
      'atencao:Custo:RIS',
      'atencao:Meta:Atrás',
    ]);
  });

  it('cada alerta diz o que está errado e contra o quê', async () => {
    const { tela } = await abrir();
    const [prazo, custo, meta, risco] = tela.alertas;
    expect(prazo).toMatchObject({ situacao: 'Atrasado', referencia: 'Execução venceu em 15/06', contexto: 'Fase atual: Execução', responsavel: 'Cláudio' });
    expect(custo.situacao).toContain('acima');
    expect(meta).toMatchObject({ situacao: '50% realizado', referencia: 'prazo venceu em 30/06', query: { abrir: 'OE1' } });
    expect(risco.situacao).toBe('10% concluído');
  });

  it('próximos 30 dias: fases e metas que vencem, em ordem', async () => {
    const { tela } = await abrir();
    expect(tela.proximos.map((v) => [v.marco, v.dono, tela.emDias(v.data)])).toEqual([
      ['Execução', 'RIS', 'em 9 dias'],
      ['Vence logo', 'Meta', 'em 19 dias'],
    ]);
  });

  it('registra o retrato do dia', async () => {
    const { api } = await abrir();
    const req = api.expectOne('/api/retratos/hoje');
    expect(req.request.body).toEqual({ prazoOk: 1, prazoTotal: 3, custoOk: 1, custoTotal: 3, metasOk: 2, metasTotal: 4, alertas: 6 });
  });

  it('formatação de datas e iniciais', async () => {
    const { tela } = await abrir();
    const d = new Date(2026, 6, 2);
    expect([tela.dia(d), tela.diaDoMes(d), tela.mes(d), tela.emDias(d)]).toEqual(['02/07', '02', 'JUL', 'amanhã']);
    expect(tela.emDias(new Date(2026, 6, 1))).toBe('hoje');
    expect([tela.iniciais('Ana Maria Souza'), tela.iniciais('Ana'), tela.iniciais(undefined)]).toEqual(['AS', 'A', '']);
  });

  it('mostra os alertas na tela', async () => {
    const { el } = await abrir();
    expect(el.textContent).toContain('Atrasado');
    expect(el.textContent).toContain('Vence logo');
  });
});
