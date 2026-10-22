import { ProjetoRequest } from '../models/projeto';
import { progressoProjeto } from './saude';

// Índices de desempenho pelo método do valor agregado (PMBOK).
// VP (planejado)  = orçamento × % do prazo decorrido
// VA (agregado)   = orçamento × % de avanço físico (entregas concluídas)
// CR (realizado)  = custo já gasto
// IDP = VA / VP, IDC = VA / CR, índice crítico = IDP × IDC.
// 1 é o plano; abaixo de 1 é atraso (IDP) ou gasto acima do entregue (IDC).

// Desvio (em %) a partir do qual o projeto sai da faixa aceitável.
export const TOLERANCIA_DESVIO = 10;

export interface Desvio {
  idp: number | null;
  idc: number | null;
  indiceCritico: number | null;
  // (índice crítico − 1) em %: negativo é pior que o plano.
  desvioReal: number | null;
  noPrazo: boolean | null;
  dentro: boolean | null;
}

function lerData(valor?: string): number | null {
  if (!valor) return null;
  const [a, m, d] = valor.split('-').map(Number);
  return a && m && d ? new Date(a, m - 1, d).getTime() : null;
}

// Fração do prazo já decorrida (0 a 1).
export function fracaoDecorrida(p: ProjetoRequest, hoje: Date = new Date()): number | null {
  const ini = lerData(p.dataInicioPrevista);
  const fim = lerData(p.dataConclusaoPrevista);
  if (ini == null || fim == null || fim <= ini) return null;
  return Math.min(1, Math.max(0, (hoje.getTime() - ini) / (fim - ini)));
}

export function calcularDesvio(p: ProjetoRequest, hoje: Date = new Date()): Desvio {
  const tempo = fracaoDecorrida(p, hoje);
  const fisico = progressoProjeto(p) / 100;
  const orcamento = p.orcamentoEstimado ?? 0;
  const gasto = p.custoRealizado ?? 0;

  const idp = tempo ? fisico / tempo : null;
  const idc = orcamento > 0 && gasto > 0 ? (orcamento * fisico) / gasto : null;
  const indiceCritico = idp != null && idc != null ? idp * idc : null;
  const desvioReal = indiceCritico != null ? (indiceCritico - 1) * 100 : null;
  const limite = 1 - TOLERANCIA_DESVIO / 100;

  return {
    idp,
    idc,
    indiceCritico,
    desvioReal,
    noPrazo: idp != null ? idp >= limite : null,
    dentro: desvioReal != null ? Math.abs(desvioReal) <= TOLERANCIA_DESVIO : null,
  };
}
