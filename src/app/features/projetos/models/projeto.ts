export type StatusProjeto = 'RASCUNHO' | 'AGUARDANDO_APROVACAO' | 'APROVADO' | 'REJEITADO';

export type SituacaoFase = 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDA';

export interface Atividade {
  id: string;
  titulo: string;
  responsavel?: string | null;
  prazo?: string | null;
  percentual?: number | null;
  situacao: SituacaoFase;
}

export type AtividadeRequest = Omit<Atividade, 'id' | 'situacao'> & { situacao?: SituacaoFase };

export interface FaseProjeto {
  // Fases já gravadas têm id; é ele que liga a fase às suas atividades.
  id?: string;
  nome: string;
  duracaoMeses: number;
  situacao?: SituacaoFase;
  percentual?: number;
  dataInicio?: string;
  dataFim?: string;
  atividades?: Atividade[];
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
  // Contas de gestor de projeto escolhidas como PO e Scrum Master.
  poId?: string | null;
  scrumMasterId?: string | null;
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
  pontoAtencao?: string;
  recomendacao?: string;
  status?: StatusProjeto;
}

// Registro datado do andamento, escrito por PO, Scrum Master ou Escritório de Projetos.
export interface Atualizacao {
  id: string;
  data: string;
  texto: string;
  autor?: string | null;
}

// O que PO e Scrum Master mudam no projeto: pontos de atenção e o andamento das fases existentes.
export interface AcompanhamentoRequest {
  pontoAtencao?: string;
  fases: ({ id: string } & Pick<FaseProjeto, 'situacao' | 'percentual' | 'dataInicio' | 'dataFim'>)[];
}

export interface PessoaResumo {
  id: string;
  nome: string;
}

export type MotivoAposentadoria = 'CONCLUIDO' | 'CANCELADO' | 'INCORPORADO';

export const MOTIVOS_APOSENTADORIA: { valor: MotivoAposentadoria; rotulo: string }[] = [
  { valor: 'CONCLUIDO', rotulo: 'Concluído' },
  { valor: 'CANCELADO', rotulo: 'Cancelado' },
  { valor: 'INCORPORADO', rotulo: 'Incorporado a outro projeto' },
];

export function rotuloMotivo(motivo?: MotivoAposentadoria | null): string {
  return MOTIVOS_APOSENTADORIA.find((m) => m.valor === motivo)?.rotulo ?? '—';
}

// Projeto aposentado: fica no histórico, fora do portfólio ativo e só para leitura.
export interface Aposentadoria {
  data: string;
  motivo: MotivoAposentadoria;
  observacao?: string | null;
  autor?: string | null;
}

export interface AposentadoriaRequest {
  motivo: MotivoAposentadoria;
  data?: string | null;
  observacao?: string | null;
}

// Ativos entram nos totais e nas telas; aposentados só no histórico.
export type SituacaoPortfolio = 'ativos' | 'aposentados' | 'todos';

export interface ProjetoResponse extends ProjetoRequest {
  id: string;
  po?: PessoaResumo | null;
  scrumMaster?: PessoaResumo | null;
  // Mais recente primeiro.
  atualizacoes?: Atualizacao[];
  aposentadoria?: Aposentadoria | null;
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
