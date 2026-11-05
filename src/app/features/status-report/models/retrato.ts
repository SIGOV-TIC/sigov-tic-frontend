// Retrato de um projeto numa quinzena, como o backend o congelou na emissão.
export type Metrica =
  | 'PERCENTUAL_CONCLUIDO'
  | 'PERCENTUAL_ESPERADO'
  | 'IDP'
  | 'IDC'
  | 'ORCADO'
  | 'REALIZADO'
  | 'ATIVIDADES_ABERTAS'
  | 'ATIVIDADES_ATRASADAS'
  | 'FASES_CONCLUIDAS'
  | 'FASES_TOTAL';

export interface Fato {
  metrica: Metrica;
  valor: number | null;
  meta: number | null;
}

export interface Retrato {
  id: string;
  projetoId: string;
  sigla: string;
  area: string | null;
  gerente: string | null;
  quinzenaInicio: string;
  quinzenaFim: string;
  emitidoEm: string;
  autor: string;
  andamento: string | null;
  pontoAtencao: string | null;
  recomendacao: string | null;
  fatos: Fato[];
}

export function valor(retrato: Retrato | null, metrica: Metrica): number | null {
  return retrato?.fatos.find((f) => f.metrica === metrica)?.valor ?? null;
}

export function meta(retrato: Retrato | null, metrica: Metrica): number | null {
  return retrato?.fatos.find((f) => f.metrica === metrica)?.meta ?? null;
}

// Recorte dos dados brutos: é ele que vive na URL e vai para o endpoint e para o CSV.
export interface Recorte {
  projeto?: string | null;
  area?: string | null;
  de?: string | null;
  ate?: string | null;
  metricas?: Metrica[];
}

// Uma linha por fato, como o endpoint de dados brutos devolve.
export interface LinhaFato {
  projetoId: string;
  sigla: string;
  area: string | null;
  gerente: string | null;
  quinzenaInicio: string;
  quinzenaFim: string;
  emitidoEm: string;
  metrica: Metrica;
  valor: number | null;
  meta: number | null;
}

export const ROTULO_METRICA: Record<Metrica, string> = {
  PERCENTUAL_CONCLUIDO: 'Avanço concluído',
  PERCENTUAL_ESPERADO: 'Avanço esperado pelo prazo',
  IDP: 'IDP · desempenho de prazo',
  IDC: 'IDC · desempenho de custo',
  ORCADO: 'Orçado',
  REALIZADO: 'Custo realizado',
  ATIVIDADES_ABERTAS: 'Atividades abertas',
  ATIVIDADES_ATRASADAS: 'Atividades atrasadas',
  FASES_CONCLUIDAS: 'Fases concluídas',
  FASES_TOTAL: 'Fases no total',
};

export const METRICAS = Object.keys(ROTULO_METRICA) as Metrica[];

// Como cada métrica se lê: percentual, dinheiro, índice ou contagem.
export function formatarMetrica(metrica: Metrica, valor: number | null): string {
  if (valor == null) return '—';
  if (metrica === 'PERCENTUAL_CONCLUIDO' || metrica === 'PERCENTUAL_ESPERADO') return `${valor}%`;
  if (metrica === 'IDP' || metrica === 'IDC') {
    return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (metrica === 'ORCADO' || metrica === 'REALIZADO') {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  }
  return valor.toLocaleString('pt-BR');
}
