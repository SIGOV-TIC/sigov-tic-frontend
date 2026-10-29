import { analisarCusto, situacaoCusto } from './custo';
import { projeto } from '../../../testing/dados';

describe('custo', () => {
  it('gasto acima do orçado é estouro', () => {
    expect(situacaoCusto(100, 120, 90)).toBe('ESTOURADO');
  });

  it('gasto mais de 15 pontos à frente do avanço é alerta', () => {
    expect(situacaoCusto(100, 80, 50)).toBe('ALERTA');
    expect(situacaoCusto(100, 65, 50)).toBe('OK');
  });

  it('analisa o projeto pelo avanço físico', () => {
    expect(analisarCusto(projeto())).toEqual({
      orcado: 1_000_000,
      gasto: 400_000,
      saldo: 600_000,
      pctGasto: 40,
      avanco: 50,
      situacao: 'OK',
    });
  });

  it('sem orçamento não há análise; gasto negativo vale zero', () => {
    expect(analisarCusto(projeto({ orcamentoEstimado: 0 }))).toBeNull();
    expect(analisarCusto(projeto({ custoRealizado: -10 }))!.gasto).toBe(0);
  });
});
