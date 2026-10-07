export type StatusProjeto = 'RASCUNHO' | 'AGUARDANDO_APROVACAO' | 'APROVADO' | 'REJEITADO';

export type SituacaoFase = 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDA';

export interface FaseProjeto {
  nome: string;
  duracaoMeses: number;
  situacao?: SituacaoFase;
  percentual?: number;
  dataInicio?: string;
  dataFim?: string;
}

export type TipoProjeto = 'PRODUTO_TI' | 'SOLUCAO_TECNOLOGICA';
export type FaseCiclo = 'NAO_CLASSIFICADA' | 'PLANEJAMENTO' | 'EXECUCAO' | 'ENCERRAMENTO';
export type QuadrantePrazo = 'NO_PRAZO' | 'ATENCAO' | 'ATRASADO' | 'CONCLUIDO';
export type QuadranteCusto = 'NO_CUSTO' | 'ATENCAO' | 'ESTOURADO' | 'CONCLUIDO';

export interface ProjetoRequest {
  nome: string;
  sigla: string;
  areaSolicitante?: string;
  areaExecutora?: string;
  descricao?: string;
  objetivo?: string;
  justificativa?: string;
  beneficiosEsperados?: string;
  priorizadoPdtic?: boolean;
  objetivoEstrategico?: string;
  iniciativaEstrategica?: string;
  inovador?: boolean;
  justificativaInovador?: string;
  indicadorEstrategico?: string;
  tipo?: TipoProjeto;
  faseCiclo?: FaseCiclo;
  po?: string;
  scrumMaster?: string;
  patrocinador?: string;
  gerenteResponsavel?: string;
  dataInicioPrevista?: string;
  dataConclusaoPrevista?: string;
  prazoQuadrante?: QuadrantePrazo;
  custoQuadrante?: QuadranteCusto;
  orcamentoEstimado?: number;
  custoRealizado?: number;
  qtdProprios?: number;
  qtdTerceiros?: number;
  fases?: FaseProjeto[];
  atualizacoes?: string;
  pontoAtencao?: string;
  recomendacao?: string;
  status?: StatusProjeto;
}

export interface ProjetoResponse extends ProjetoRequest {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjetoPageResponse {
  content: ProjetoResponse[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
