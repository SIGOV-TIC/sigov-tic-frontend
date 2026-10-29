import { avaliarMeta } from './meta';
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

  it('sem data de início, conta da criação', () => {
    const a = avaliarMeta(meta({ dataInicio: null, createdAt: '2026-04-01T12:00:00' }), meioDoAno);
    expect(a.esperado).toBeLessThan(50);
  });
});
