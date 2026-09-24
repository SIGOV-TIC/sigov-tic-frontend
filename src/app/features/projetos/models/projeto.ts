export type StatusProjeto = 'RASCUNHO' | 'AGUARDANDO_APROVACAO' | 'APROVADO' | 'REJEITADO';

export interface FaseProjeto {
  nome: string;
  duracaoMeses: number;
}

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
  po?: string;
  scrumMaster?: string;
  patrocinador?: string;
  gerenteResponsavel?: string;
  dataInicioPrevista?: string;
  dataConclusaoPrevista?: string;
  orcamentoEstimado?: number;
  fases?: FaseProjeto[];
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
