import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Orcamento } from './orcamento';
import { entrarComo, projeto, redesenhar, responderListagem } from '../../../testing/dados';

// Avanço de 50% em todos (fases do projeto padrão).
const lista = [
  projeto({ id: 'ok', sigla: 'OK', areaSolicitante: 'Sistemas', orcamentoEstimado: 1_000_000, custoRealizado: 400_000 }),
  projeto({ id: 'alerta', sigla: 'ALE', areaSolicitante: 'Sistemas', orcamentoEstimado: 100_000, custoRealizado: 80_000 }),
  projeto({ id: 'estouro', sigla: 'EST', areaSolicitante: 'Infra', orcamentoEstimado: 200_000, custoRealizado: 250_000 }),
  projeto({ id: 'sem', sigla: 'SEM', areaSolicitante: 'Infra', orcamentoEstimado: 0 }),
];

async function abrir() {
  entrarComo('USER');
  TestBed.configureTestingModule({ imports: [Orcamento], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(Orcamento);
  const api = TestBed.inject(HttpTestingController);
  await fixture.whenStable();
  responderListagem(api, lista);
  await redesenhar(fixture);
  return { tela: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
}

describe('Orçamento', () => {
  afterEach(() => localStorage.clear());

  it('ordena do pior para o melhor e explica o motivo', async () => {
    const { tela } = await abrir();
    expect(tela.linhas.map((l) => [l.projeto.sigla, l.situacao])).toEqual([
      ['EST', 'ESTOURADO'],
      ['ALE', 'ALERTA'],
      ['OK', 'OK'],
    ]);
    expect(tela.linhas[0].motivo).toContain('além do orçado (125% do previsto)');
    expect(tela.linhas[1].motivo).toBe('Gastou 80% do orçado, mas o avanço é de 50%.');
    expect(tela.atencao).toHaveLength(2);
  });

  it('projeto sem orçamento fica fora das contas e é contado à parte', async () => {
    const { tela } = await abrir();
    expect(tela.semOrcamento).toBe(1);
    expect(tela.totalOrcado).toBe(1_300_000);
    expect(tela.totalGasto).toBe(730_000);
    expect(tela.saldo).toBe(570_000);
    expect(tela.execucao).toBe(56);
  });

  it('agrupa por área, com avanço ponderado pelo orçamento; áreas com problema já abertas', async () => {
    const { tela } = await abrir();
    const areas = tela.porArea;
    expect(areas.map((a) => [a.area, a.situacao])).toEqual([
      ['Infra', 'ESTOURADO'],
      ['Sistemas', 'OK'],
    ]);
    expect(areas[1].pctGasto).toBe(44);
    expect(tela.abertas.has('Infra')).toBe(true);
    expect(tela.abertas.has('Sistemas')).toBe(true);
  });

  it('filtro por área', async () => {
    const { tela } = await abrir();
    expect(tela.areas).toEqual(['Infra', 'Sistemas']);
    tela.area = 'Sistemas';
    expect(tela.linhas.map((l) => l.projeto.sigla)).toEqual(['ALE', 'OK']);
    expect(tela.semOrcamento).toBe(0);
  });

  it('abre e fecha áreas', async () => {
    const { tela } = await abrir();
    expect(tela.todasAbertas).toBe(true);
    tela.alternarTodas();
    expect(tela.abertas.size).toBe(0);
    tela.alternar('Infra');
    expect(tela.abertas.has('Infra')).toBe(true);
    tela.alternarTodas();
    expect(tela.todasAbertas).toBe(true);
  });

  it('barra nunca passa de 0–100%', async () => {
    const { tela } = await abrir();
    expect([tela.largura(-5), tela.largura(140), tela.largura(40)]).toEqual([0, 100, 40]);
  });
});
