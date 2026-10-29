import { calcularDesvio, fracaoDecorrida, TOLERANCIA_DESVIO } from './desvio';
import { dia, projeto } from '../../../testing/dados';

describe('índices de desempenho (valor agregado)', () => {
  const meioDoAno = dia('2026-07-01');

  it('fração do prazo decorrida fica entre 0 e 1', () => {
    expect(fracaoDecorrida(projeto(), meioDoAno)).toBeCloseTo(181 / 364, 2);
    expect(fracaoDecorrida(projeto(), dia('2025-06-01'))).toBe(0);
    expect(fracaoDecorrida(projeto(), dia('2027-06-01'))).toBe(1);
    expect(fracaoDecorrida(projeto({ dataConclusaoPrevista: '2025-01-01' }), meioDoAno)).toBeNull();
  });

  it('IDP compara o avanço físico com o tempo; IDC, o entregue com o gasto', () => {
    const d = calcularDesvio(projeto(), meioDoAno);
    expect(d.idp).toBeCloseTo(0.5 / fracaoDecorrida(projeto(), meioDoAno)!, 6);
    expect(d.idc).toBeCloseTo(1.25, 3); // 50% de 1 mi entregues por 400 mil
    expect(d.indiceCritico).toBeCloseTo(d.idp! * d.idc!, 6);
    expect(d.noPrazo).toBe(true);
  });

  it('projeto atrasado e caro sai da tolerância', () => {
    const p = projeto({ custoRealizado: 800_000 });
    p.fases![1].percentual = 0; // avanço de 25%
    const d = calcularDesvio(p, meioDoAno);
    expect(d.idp).toBeLessThan(1 - TOLERANCIA_DESVIO / 100);
    expect(d.noPrazo).toBe(false);
    expect(d.desvioReal).toBeLessThan(-TOLERANCIA_DESVIO);
    expect(d.dentro).toBe(false);
  });

  it('sem gasto não há IDC; sem datas não há IDP', () => {
    expect(calcularDesvio(projeto({ custoRealizado: 0 }), meioDoAno).idc).toBeNull();
    const semDatas = calcularDesvio(projeto({ dataInicioPrevista: undefined }), meioDoAno);
    expect(semDatas.idp).toBeNull();
    expect(semDatas.noPrazo).toBeNull();
    expect(semDatas.dentro).toBeNull();
  });

  it('antes do início o IDP não é calculado', () => {
    expect(calcularDesvio(projeto(), dia('2025-12-01')).idp).toBeNull();
  });
});
