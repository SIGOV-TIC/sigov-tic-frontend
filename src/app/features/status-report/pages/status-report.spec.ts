import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { StatusReport } from './status-report';
import { dia, entrarComo, projeto, redesenhar, responderListagem } from '../../../testing/dados';

function completo() {
  const p = projeto({
    id: 'p1',
    sigla: 'ERP',
    atualizacoes: [
      { id: 'a1', data: '2026-07-10', texto: 'Dentro da quinzena', autor: 'Ana' },
      { id: 'a2', data: '2026-06-28', texto: 'Quinzena anterior' },
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

async function abrir(quinzena?: string) {
  entrarComo('USER');
  TestBed.configureTestingModule({
    imports: [StatusReport],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(quinzena ? { quinzena } : {}) } } },
    ],
  });
  vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(StatusReport);
  const api = TestBed.inject(HttpTestingController);
  await fixture.whenStable();
  responderListagem(api, [projeto({ id: 'p2', sigla: 'ZZZ' }), projeto({ id: 'p1', sigla: 'ERP' })]);
  api.expectOne('/api/projetos/p1').flush(completo());
  await redesenhar(fixture);
  return { tela: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
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

  it('oferece a quinzena atual e as cinco anteriores', async () => {
    const { tela } = await abrir();
    expect(tela.quinzenas.map((q) => q.rotulo)).toEqual([
      '1 a 15 de jul 2026',
      '16 a 30 de jun 2026',
      '1 a 15 de jun 2026',
      '16 a 31 de mai 2026',
      '1 a 15 de mai 2026',
      '16 a 30 de abr 2026',
    ]);
    expect(tela.quinzena.chave).toBe('2026-7-1');
  });

  it('abre o primeiro projeto pela sigla, com as atualizações só da quinzena', async () => {
    const { tela, el } = await abrir();
    expect(tela.projetos.map((p) => p.sigla)).toEqual(['ERP', 'ZZZ']);
    expect(tela.atualizacoesDoPeriodo.map((a) => a.id)).toEqual(['a1']);
    expect(el.textContent).toContain('Dentro da quinzena');
    expect(el.textContent).not.toContain('Quinzena anterior');
  });

  it('atividades atrasadas e as que vencem nos 15 dias seguintes', async () => {
    const { tela } = await abrir();
    expect(tela.atrasadas.map((a) => a.atividade.titulo)).toEqual(['Atrasada']);
    expect(tela.proximas.map((a) => `${a.atividade.titulo}:${a.fase}`)).toEqual(['Próxima:Execução']);
  });

  it('quinzena passada usa o fim dela como referência', async () => {
    const { tela } = await abrir('2026-6-2');
    expect(tela.quinzena.rotulo).toBe('16 a 30 de jun 2026');
    expect(tela.atualizacoesDoPeriodo.map((a) => a.id)).toEqual(['a2']);
    // Em 30/06 a de 05/07 ainda não tinha vencido.
    expect(tela.atrasadas).toHaveLength(0);
    expect(tela.proximas.map((a) => a.atividade.titulo)).toEqual(['Atrasada']);
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
});
