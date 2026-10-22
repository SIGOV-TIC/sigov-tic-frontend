import { ProjetoRequest } from '../models/projeto';
import { indiceFaseAtual, situacaoFase } from './fase';

// Regra única de saúde do projeto, usada por Dashboard, Cronograma, Orçamento e Objetivos.
// O sistema só mostra; quem decide o que fazer é o gestor.

export type Estado = 'CONCLUIDO' | 'ANDAMENTO' | 'RISCO' | 'ATRASADO' | 'A_INICIAR';

// Pontos percentuais de atraso do andamento em relação ao tempo decorrido a partir dos quais a fase vira "em risco".
export const MARGEM_RISCO_PONTOS = 15;

// Prioridade para ordenar: o pior estado primeiro.
export const ORDEM_ESTADOS: Estado[] = ['ATRASADO', 'RISCO', 'ANDAMENTO', 'A_INICIAR', 'CONCLUIDO'];

export const ROTULO_ESTADO: Record<Estado, string> = {
  ATRASADO: 'Atrasado',
  RISCO: 'Em risco',
  ANDAMENTO: 'Em andamento',
  A_INICIAR: 'A iniciar',
  CONCLUIDO: 'Concluído',
};

// Ícone (Material) por estado: a cor nunca é o único sinal.
export const ICONE_ESTADO: Record<Estado, string> = {
  ATRASADO: 'error',
  RISCO: 'warning',
  ANDAMENTO: 'play_circle',
  A_INICIAR: 'schedule',
  CONCLUIDO: 'check_circle',
};

export interface Janela {
  ini: number;
  fim: number;
}

export interface Analise {
  posInicio: number;
  posFim: number;
  posHoje: number;
  janelas: Janela[];
  estados: Estado[];
  estado: Estado;
  atual: number;
}

function lerData(valor?: string): Date | null {
  if (!valor) return null;
  const [a, m, d] = valor.split('-').map(Number);
  return a && m && d ? new Date(a, m - 1, d) : null;
}

// Posição em "meses desde o ano 0", com fração do mês pelo dia.
export function posicaoMeses(data: Date): number {
  const dias = new Date(data.getFullYear(), data.getMonth() + 1, 0).getDate();
  return data.getFullYear() * 12 + data.getMonth() + (data.getDate() - 1) / dias;
}

export function estadoFase(
  p: ProjetoRequest,
  i: number,
  atual: number,
  janela: Janela,
  posHoje: number,
): Estado {
  if (situacaoFase(p, i) === 'CONCLUIDA') return 'CONCLUIDO';
  if (posHoje < janela.ini) return 'A_INICIAR';
  // Já deveria ter começado e a fase anterior ainda não fechou.
  if (i !== atual) return 'ATRASADO';
  if (posHoje > janela.fim) return 'ATRASADO';

  const fase = p.fases![i];
  if (fase.percentual != null) {
    const tempo = ((posHoje - janela.ini) / (janela.fim - janela.ini)) * 100;
    if (fase.percentual < tempo - MARGEM_RISCO_PONTOS) return 'RISCO';
    return 'ANDAMENTO';
  }
  if (p.prazoQuadrante === 'ATRASADO') return 'ATRASADO';
  if (p.prazoQuadrante === 'ATENCAO') return 'RISCO';
  return 'ANDAMENTO';
}

function estadoDoProjeto(
  p: ProjetoRequest,
  estados: Estado[],
  posHoje: number,
  posInicio: number,
  posFim: number,
): Estado {
  if (p.prazoQuadrante === 'CONCLUIDO' || (estados.length > 0 && estados.every((e) => e === 'CONCLUIDO'))) {
    return 'CONCLUIDO';
  }
  if (estados.some((e) => e === 'ATRASADO')) return 'ATRASADO';
  if (estados.some((e) => e === 'RISCO')) return 'RISCO';
  if (posHoje < posInicio) return 'A_INICIAR';
  if (estados.length === 0) {
    if (posHoje > posFim || p.prazoQuadrante === 'ATRASADO') return 'ATRASADO';
    if (p.prazoQuadrante === 'ATENCAO') return 'RISCO';
  }
  return 'ANDAMENTO';
}

// Janelas e estados de cada fase, mais o estado do projeto. Null se o projeto não tem datas válidas.
export function analisarProjeto(p: ProjetoRequest, hoje: Date = new Date()): Analise | null {
  const inicio = lerData(p.dataInicioPrevista);
  const fim = lerData(p.dataConclusaoPrevista);
  if (!inicio || !fim || fim < inicio) return null;

  const posInicio = posicaoMeses(inicio);
  const posFim = posicaoMeses(fim) + 1 / 30;
  const posHoje = posicaoMeses(hoje);
  const atual = indiceFaseAtual(p);
  const fases = p.fases ?? [];

  // Janela de cada fase: datas da própria fase, ou duração acumulada a partir do início do projeto.
  const totalDuracao = fases.reduce((acc, f) => acc + Math.max(f.duracaoMeses || 1, 1), 0);
  const escala = totalDuracao > posFim - posInicio ? (posFim - posInicio) / totalDuracao : 1;
  let acumulado = 0;
  const janelas = fases.map((f) => {
    const dur = Math.max(f.duracaoMeses || 1, 1) * escala;
    const faseIni = lerData(f.dataInicio);
    const faseFim = lerData(f.dataFim);
    const janela =
      faseIni && faseFim && faseFim > faseIni
        ? { ini: posicaoMeses(faseIni), fim: posicaoMeses(faseFim) + 1 / 30 }
        : { ini: posInicio + acumulado, fim: posInicio + acumulado + dur };
    acumulado += dur;
    return janela;
  });

  const estados = fases.map((_, i) => estadoFase(p, i, atual, janelas[i], posHoje));
  const estado = estadoDoProjeto(p, estados, posHoje, posInicio, posFim);
  return { posInicio, posFim, posHoje, janelas, estados, estado, atual };
}

// Estado do projeto; "A_INICIAR" quando não há datas para avaliar.
export function estadoProjeto(p: ProjetoRequest, hoje: Date = new Date()): Estado {
  return analisarProjeto(p, hoje)?.estado ?? 'A_INICIAR';
}

// Avanço físico do projeto (0 a 100), ponderado pela duração de cada fase.
// Concluída vale 100, em andamento vale o percentual informado (ou 0), pendente vale 0.
export function progressoProjeto(p: ProjetoRequest): number {
  const fases = p.fases ?? [];
  if (fases.length === 0) return p.prazoQuadrante === 'CONCLUIDO' ? 100 : 0;
  let total = 0;
  let feito = 0;
  fases.forEach((f, i) => {
    const peso = Math.max(f.duracaoMeses || 1, 1);
    const situacao = situacaoFase(p, i);
    total += peso;
    if (situacao === 'CONCLUIDA') feito += peso;
    else if (situacao === 'EM_ANDAMENTO') feito += (peso * Math.min(f.percentual ?? 0, 100)) / 100;
  });
  return Math.round((feito / total) * 100);
}
