import { Gasto } from '../models/gasto';

export interface MesRealizado {
  // 'aaaa-mm'
  mes: string;
  noMes: number;
  acumulado: number;
  gastos: Gasto[];
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function mesAtual(hoje = new Date()): string {
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
}

export function proximoMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`;
}

// 'out/26' no eixo dos gráficos, 'out/2026' nas tabelas.
export function rotuloMes(mes: string, anoCurto = false): string {
  const [a, m] = mes.split('-');
  return `${MESES[Number(m) - 1]}/${anoCurto ? a.slice(2) : a}`;
}

// Um ponto por mês, do primeiro gasto até `ate` (ou o último gasto), sem buraco:
// mês sem gasto entra com zero no mês e repete o acumulado.
export function linhaDoTempo(gastos: Gasto[], ate?: string): MesRealizado[] {
  if (!gastos.length) return [];
  const porMes = new Map<string, Gasto[]>();
  gastos.forEach((g) => porMes.set(g.mes, [...(porMes.get(g.mes) ?? []), g]));
  const meses = [...porMes.keys()].sort();
  const fim = ate && ate > meses[meses.length - 1] ? ate : meses[meses.length - 1];

  const linhas: MesRealizado[] = [];
  let acumulado = 0;
  for (let mes = meses[0]; mes <= fim; mes = proximoMes(mes)) {
    const doMes = porMes.get(mes) ?? [];
    const noMes = doMes.reduce((s, g) => s + g.valor, 0);
    acumulado += noMes;
    linhas.push({ mes, noMes, acumulado, gastos: doMes });
  }
  return linhas;
}

// Realizado acumulado até o fim do mês informado.
export function acumuladoAte(gastos: Gasto[], mes: string): number {
  return gastos.filter((g) => g.mes <= mes).reduce((s, g) => s + g.valor, 0);
}
