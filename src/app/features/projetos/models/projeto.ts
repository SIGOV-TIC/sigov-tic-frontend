export type StatusProjeto = 'RASCUNHO' | 'AGUARDANDO_APROVACAO' | 'APROVADO' | 'REJEITADO';

export interface ProjetoRequest {
  nome: string;
  sigla: string;
  area?: string;
  unidadeExecutora?: string;
  descricao?: string;
  objetivo?: string;
  justificativa?: string;
  beneficiosEsperados?: string;
  programa?: string;
  objetivoEstrategico?: string;
  iniciativaEstrategica?: string;
  indicadorEstrategico?: string;
  po?: string;
  scrumMaster?: string;
  sponsor?: string;
  gerenteResponsavel?: string;
  dataInicioPrevista?: string;
  dataConclusaoPrevista?: string;
  orcamentoEstimado?: number;
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
