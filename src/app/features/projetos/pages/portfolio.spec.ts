import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Portfolio } from './portfolio';
import { dia, entrarComo, projeto, redesenhar, responderListagem } from '../../../testing/dados';

const lista = [
  projeto({ id: 'p1', nome: 'Implantação do ERP', sigla: 'ERP', areaSolicitante: 'Sistemas', qtdProprios: 3, qtdTerceiros: 2 }),
  projeto({ id: 'p2', nome: 'Rede nova', sigla: 'REDE', areaSolicitante: 'Infraestrutura', orcamentoEstimado: 500_000, custoRealizado: 450_000, qtdProprios: 1 }),
  projeto({ id: 'p3', nome: 'Portal', sigla: 'PSD', areaSolicitante: 'Sistemas', orcamentoEstimado: undefined, custoRealizado: undefined }),
];

async function abrir(perfil: 'ESCRITORIO' | 'USER' = 'USER') {
  entrarComo(perfil);
  TestBed.configureTestingModule({ imports: [Portfolio], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(Portfolio);
  const api = TestBed.inject(HttpTestingController);
  await fixture.whenStable();
  responderListagem(api, lista);
  await redesenhar(fixture);
  return { fixture, tela: fixture.componentInstance, el: fixture.nativeElement as HTMLElement, api };
}

describe('Portfólio', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(dia('2026-07-01'));
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('mostra os projetos e soma os totais', async () => {
    const { tela, el } = await abrir();
    expect(el.textContent).toContain('Implantação do ERP');
    expect(tela.totalOrcamento).toBe(1_500_000);
    expect(tela.totalRealizado).toBe(850_000);
    expect(tela.totalProprios).toBe(4);
    expect(tela.totalTerceiros).toBe(2);
  });

  it('busca por nome, sigla ou área, sem diferenciar maiúsculas', async () => {
    const { tela } = await abrir();
    tela.busca = 'sistemas';
    tela.filtrar();
    expect(tela.projetosFiltrados.map((p) => p.sigla)).toEqual(['ERP', 'PSD']);
    tela.busca = 'rede';
    tela.filtrar();
    expect(tela.projetosFiltrados.map((p) => p.sigla)).toEqual(['REDE']);
    tela.busca = '  ';
    tela.filtrar();
    expect(tela.projetosFiltrados).toHaveLength(3);
  });

  it('conta os projetos fora da faixa de ±10%, para cima ou para baixo', async () => {
    const { tela } = await abrir();
    // REDE: 90% gasto com 50% de avanço → IDC 0,56. ERP: 40% gasto com 50% de avanço → IDC 1,25.
    expect(tela.foraDaFaixa).toBe(2);
    expect(tela.desvio(lista[0]).desvioReal).toBeGreaterThan(10);
    expect(tela.formatarIndice(tela.desvio(lista[1]).idc)).toBe('0,56');
    expect(tela.formatarIndice(null)).toBe('—');
  });

  it('formatações da tabela', async () => {
    const { tela } = await abrir();
    expect(tela.percentualGasto(lista[1])).toBe(90);
    expect(tela.percentualGasto(lista[2])).toBeNull();
    expect(tela.percentualDecorrido(lista[0])).toBe(50);
    expect(tela.formatarDesvio(12.4)).toBe('+12%');
    expect(tela.formatarDesvio(-3.6)).toBe('-4%');
    expect(tela.statusLabel('AGUARDANDO_APROVACAO')).toBe('Aguardando Aprovação');
    expect(tela.statusLabel(undefined)).toBe('Rascunho');
  });

  it('pagina de 10 em 10', async () => {
    const { tela } = await abrir();
    tela.projetosFiltrados = Array.from({ length: 23 }, (_, i) => projeto({ id: 'x' + i }));
    expect(tela.projetosDaPagina).toHaveLength(10);
  });

  it('falha da API mostra o erro', async () => {
    entrarComo('USER');
    TestBed.configureTestingModule({ imports: [Portfolio], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(Portfolio);
    const api = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
    api.match(() => true).forEach((r) => r.flush(null, { status: 500, statusText: 'Erro' }));
    expect(fixture.componentInstance.erro).toBe('Não foi possível carregar os projetos.');
  });
});
