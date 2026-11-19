import { avaliarMeta, metaNoAno, prazoEfetivo, rotuloCiclo } from './meta';
import { dia, meta } from '../../../testing/dados';

describe('avaliação da meta', () => {
  const meioDoAno = dia('2026-07-01');

  it('no ritmo: caminho percorrido acompanha o tempo', () => {
    const a = avaliarMeta(meta(), meioDoAno);
    expect(a.esperado).toBe(50);
    expect(a.valorEsperado).toBe(50);
    expect(a.atingido).toBe(50);
    expect(a.estado).toBe('ANDAMENTO');
    expect(a.foraDoRitmo).toBe(false);
  });

  it('mais de 15 pontos atrás do tempo é risco', () => {
    const a = avaliarMeta(meta({ valorAtual: 20 }), meioDoAno);
    expect(a.estado).toBe('RISCO');
    expect(a.foraDoRitmo).toBe(true);
  });

  it('sem medição está a iniciar', () => {
    const a = avaliarMeta(meta({ valorAtual: null }), meioDoAno);
    expect(a.atingido).toBeNull();
    expect(a.estado).toBe('A_INICIAR');
  });

  it('alvo alcançado conclui, mesmo depois do prazo', () => {
    expect(avaliarMeta(meta({ valorAtual: 120 }), dia('2027-03-01')).estado).toBe('CONCLUIDO');
  });

  it('prazo vencido sem alcançar é atraso', () => {
    const a = avaliarMeta(meta(), dia('2027-01-10'));
    expect(a.estado).toBe('ATRASADO');
    expect(a.motivo).toContain('31/12/2026');
  });

  it('meta decrescente: reduzir de 40 para 10', () => {
    const a = avaliarMeta(meta({ valorInicial: 40, valorAlvo: 10, valorAtual: 25 }), meioDoAno);
    expect(a.atingido).toBe(50);
    expect(a.valorEsperado).toBe(25);
  });

  it('sem datas, a meta corre do começo ao fim do ano do plano', () => {
    const a = avaliarMeta(meta({ dataInicio: null, prazo: null, ano: 2026 }), meioDoAno);
    expect(a.esperado).toBeGreaterThanOrEqual(49);
    expect(a.esperado).toBeLessThanOrEqual(51);
    expect(prazoEfetivo(meta({ prazo: null, ano: 2026 }))).toBe('2026-12-31');
  });

  it('no ciclo quadrienal, o prazo padrão é o fim do quarto ano', () => {
    const m = meta({ dataInicio: null, prazo: null, ano: 2027, ciclo: 'QUADRIENAL' });
    expect(prazoEfetivo(m)).toBe('2030-12-31');
    expect(rotuloCiclo(m)).toBe('2027–2030');
    expect(rotuloCiclo(meta({ ano: 2027 }))).toBe('2027');
    expect([2026, 2027, 2030, 2031].map((a) => metaNoAno(m, a))).toEqual([false, true, true, false]);
  });
});
