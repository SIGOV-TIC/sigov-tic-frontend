import { acumuladoAte, linhaDoTempo, proximoMes, rotuloMes } from './linha-do-tempo';
import { Gasto } from '../models/gasto';

const g = (mes: string, valor: number): Gasto => ({ id: mes + valor, projetoId: 'p', mes, valor, motivo: 'm', origem: 'o' });

describe('linha do tempo do realizado', () => {
  it('soma mês a mês e acumula, sem buraco entre os meses', () => {
    const linhas = linhaDoTempo([g('2026-10', 200_000), g('2026-08', 1_000_000), g('2026-10', 0.5)]);
    expect(linhas.map((l) => [l.mes, l.noMes, l.acumulado])).toEqual([
      ['2026-08', 1_000_000, 1_000_000],
      ['2026-09', 0, 1_000_000],
      ['2026-10', 200_000.5, 1_200_000.5],
    ]);
    expect(linhas[2].gastos).toHaveLength(2);
  });

  it('estende até o mês pedido e vira o ano', () => {
    const linhas = linhaDoTempo([g('2026-11', 10)], '2027-01');
    expect(linhas.map((l) => l.mes)).toEqual(['2026-11', '2026-12', '2027-01']);
    expect(linhas[2].acumulado).toBe(10);
  });

  it('sem gastos não há linha', () => {
    expect(linhaDoTempo([])).toEqual([]);
  });

  it('acumulado até um mês ignora os seguintes', () => {
    expect(acumuladoAte([g('2026-08', 1), g('2026-09', 2), g('2026-10', 4)], '2026-09')).toBe(3);
  });

  it('rótulos e virada de mês', () => {
    expect(rotuloMes('2026-10')).toBe('out/2026');
    expect(rotuloMes('2026-10', true)).toBe('out/26');
    expect(proximoMes('2026-12')).toBe('2027-01');
  });
});
