import { ProjetoRequest, SituacaoFase } from '../models/projeto';

// Cores por posição da fase; compartilhadas entre a visualização do projeto e o cronograma.
export const CORES_FASE = [
  'var(--accent-blue)',
  'var(--accent-green)',
  'var(--accent-yellow)',
  'var(--accent-red)',
  'var(--text-muted)',
];

export function corFase(indice: number): string {
  return CORES_FASE[indice % CORES_FASE.length];
}

function lerData(valor?: string): Date | null {
  if (!valor) return null;
  const [a, m, d] = valor.split('-').map(Number);
  return a && m && d ? new Date(a, m - 1, d) : null;
}

// Janela planejada de cada fase: datas da fase ou duração acumulada a partir do início do projeto.
export function janelaFase(projeto: ProjetoRequest, indice: number): { ini: Date; fim: Date } | null {
  const inicio = lerData(projeto.dataInicioPrevista);
  const fases = projeto.fases ?? [];
  if (!inicio || !fases[indice]) return null;

  const faseIni = lerData(fases[indice].dataInicio);
  const faseFim = lerData(fases[indice].dataFim);
  if (faseIni && faseFim && faseFim > faseIni) return { ini: faseIni, fim: faseFim };

  const somar = (meses: number) => {
    const r = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
    r.setMonth(r.getMonth() + Math.floor(meses));
    r.setDate(r.getDate() + Math.round((meses % 1) * 30));
    return r;
  };
  const antes = fases.slice(0, indice).reduce((acc, f) => acc + Math.max(f.duracaoMeses || 1, 1), 0);
  return { ini: somar(antes), fim: somar(antes + Math.max(fases[indice].duracaoMeses || 1, 1)) };
}

// Situação da fase. Sem situação registrada pelo gestor (dados antigos), vale o planejado:
// janela encerrada = concluída, janela em curso = em andamento, janela futura = pendente.
export function situacaoFase(projeto: ProjetoRequest, indice: number): SituacaoFase {
  const registrada = projeto.fases?.[indice]?.situacao;
  if (registrada) return registrada;

  if (!projeto.fases?.some((f) => f.situacao)) {
    const janela = janelaFase(projeto, indice);
    if (janela) {
      const hoje = new Date();
      if (janela.fim < hoje) return 'CONCLUIDA';
      if (janela.ini <= hoje) return 'EM_ANDAMENTO';
      return 'PENDENTE';
    }
  }
  return indice === 0 ? 'EM_ANDAMENTO' : 'PENDENTE';
}

export function indiceFaseAtual(projeto: ProjetoRequest): number {
  const fases = projeto.fases ?? [];
  const emAndamento = fases.findIndex((_, i) => situacaoFase(projeto, i) === 'EM_ANDAMENTO');
  return emAndamento >= 0 ? emAndamento : fases.findIndex((_, i) => situacaoFase(projeto, i) !== 'CONCLUIDA');
}

// Grava a situação de todas as fases quando o gestor passa a editá-las.
export function materializarSituacoes(projeto: ProjetoRequest): void {
  if (projeto.fases?.some((f) => f.situacao)) return;
  const situacoes = (projeto.fases ?? []).map((_, i) => situacaoFase(projeto, i));
  projeto.fases?.forEach((f, i) => (f.situacao = situacoes[i]));
}
