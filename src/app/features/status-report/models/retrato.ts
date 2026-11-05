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
