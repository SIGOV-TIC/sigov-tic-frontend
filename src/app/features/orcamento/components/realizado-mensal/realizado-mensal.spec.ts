import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RealizadoMensal } from './realizado-mensal';
import { projeto } from '../../../../testing/dados';
import { Gasto } from '../../models/gasto';

const gastos: Gasto[] = [
  { id: 'g1', projetoId: 'p1', mes: '2026-09', valor: 800_000, motivo: 'Licenças.', origem: 'Contrato 15/2026' },
  { id: 'g2', projetoId: 'p1', mes: '2026-11', valor: 500_000, motivo: 'Treinamento.', origem: 'NE 42' },
];

function abrir(podeEditar = true) {
  TestBed.configureTestingModule({ imports: [RealizadoMensal], providers: [provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(RealizadoMensal);
  fixture.componentRef.setInput('projeto', projeto({ id: 'p1', orcamentoEstimado: 5_000_000, dataInicioPrevista: '2026-08-01' }));
  fixture.componentRef.setInput('podeEditar', podeEditar);
  fixture.detectChanges();
  const api = TestBed.inject(HttpTestingController);
  api.expectOne('/api/projetos/p1/gastos').flush(gastos);
  fixture.detectChanges();
  return { tela: fixture.componentInstance, api, el: fixture.nativeElement as HTMLElement };
}

describe('RealizadoMensal', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 19));
  });
  afterEach(() => vi.useRealTimers());

  it('lista só os meses com gasto, do mais recente, com o acumulado', () => {
    const { tela } = abrir();
    expect(tela.mesesComGasto().map((l) => [l.mes, l.noMes, l.acumulado])).toEqual([
      ['2026-11', 500_000, 1_300_000],
      ['2026-09', 800_000, 800_000],
    ]);
    expect(tela.rotulos()).toEqual(['set/26', 'out/26', 'nov/26']);
  });

  it('o formulário oferece do mês corrente até o início do projeto', () => {
    const { tela } = abrir();
    const meses = tela.mesesDisponiveis;
    expect(meses[0]).toBe('2026-11');
    expect(meses).toContain('2026-08');
    expect(meses.every((m) => m <= '2026-11')).toBe(true);
  });

  it('registrar grava, soma e avisa o novo realizado', () => {
    const { tela, api } = abrir();
    let total = 0;
    tela.realizado.subscribe((v) => (total = v));
    tela.novo();
    api.expectOne('/api/gastos/origens').flush(['Contrato 15/2026']);
    Object.assign(tela.rascunho()!, { valor: 200_000, motivo: ' Aditivo. ', origem: 'Contrato 15/2026' });
    tela.salvar();
    const req = api.expectOne('/api/projetos/p1/gastos');
    expect(req.request.body).toEqual({ mes: '2026-11', valor: 200_000, motivo: 'Aditivo.', origem: 'Contrato 15/2026' });
    req.flush({ id: 'g3', projetoId: 'p1', ...req.request.body });
    expect(total).toBe(1_500_000);
    expect(tela.rascunho()).toBeNull();
  });

  it('sem motivo, origem ou valor positivo não grava', () => {
    const { tela } = abrir();
    expect(tela.completo({ mes: '2026-11', valor: 0, motivo: 'x', origem: 'y' })).toBe(false);
    expect(tela.completo({ mes: '2026-11', valor: 10, motivo: ' ', origem: 'y' })).toBe(false);
    expect(tela.completo({ mes: '2026-11', valor: 10, motivo: 'x', origem: '' })).toBe(false);
  });

  it('quem não edita não vê o botão de registrar', () => {
    const { el } = abrir(false);
    expect(el.querySelector('[aria-label="Registrar gasto"]')).toBeNull();
  });
});
