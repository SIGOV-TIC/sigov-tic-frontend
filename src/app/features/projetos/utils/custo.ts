import { ProjetoRequest } from '../models/projeto';
import { MARGEM_RISCO_PONTOS, progressoProjeto } from './saude';

// Situação do custo, da pior para a melhor.
export type SituacaoCusto = 'ESTOURADO' | 'ALERTA' | 'OK';

export const ORDEM_CUSTO: SituacaoCusto[] = ['ESTOURADO', 'ALERTA', 'OK'];

export interface AnaliseCusto {
  orcado: number;
  gasto: number;
  saldo: number;
  pctGasto: number;
  avanco: number;
  situacao: SituacaoCusto;
}

// Situação do custo a partir de totais já conhecidos (usado para o projeto e para a área).
export function situacaoCusto(orcado: number, gasto: number, avanco: number): SituacaoCusto {
  if (gasto > orcado) return 'ESTOURADO';
  const pctGasto = Math.round((gasto / orcado) * 100);
  return pctGasto - avanco > MARGEM_RISCO_PONTOS ? 'ALERTA' : 'OK';
}

// Null quando o projeto não tem orçamento informado: sem base para comparar o gasto.
export function analisarCusto(p: ProjetoRequest): AnaliseCusto | null {
  const orcado = p.orcamentoEstimado ?? 0;
  if (!(orcado > 0)) return null;
  const gasto = Math.max(p.custoRealizado ?? 0, 0);
  const avanco = progressoProjeto(p);
  return {
    orcado,
    gasto,
    saldo: orcado - gasto,
    pctGasto: Math.round((gasto / orcado) * 100),
    avanco,
    situacao: situacaoCusto(orcado, gasto, avanco),
  };
}
