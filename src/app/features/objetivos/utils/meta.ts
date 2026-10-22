import { Estado, MARGEM_RISCO_PONTOS } from '../../projetos/utils/saude';
import { Meta } from '../services/meta.service';

export interface AvaliacaoMeta {
  // Quanto do caminho entre o valor inicial e o alvo já foi percorrido (0 a 100); null sem medição.
  atingido: number | null;
  // Onde a meta deveria estar hoje, pelo tempo decorrido: em % do caminho e na unidade do indicador.
  esperado: number;
  valorEsperado: number;
  foraDoRitmo: boolean;
  estado: Estado;
  motivo: string;
}

function lerData(valor?: string | null): Date | null {
  if (!valor) return null;
  const [a, m, d] = valor.split('-').map(Number);
  return a && m && d ? new Date(a, m - 1, d) : null;
}

// Regra única da meta, usada por Objetivos e Dashboard: caminho percorrido contra o tempo decorrido até o prazo.
export function avaliarMeta(m: Meta, hoje: Date = new Date()): AvaliacaoMeta {
  const prazo = lerData(m.prazo)!;
  const inicio = lerData(m.dataInicio) ?? new Date(m.createdAt);
  const total = prazo.getTime() - inicio.getTime();
  const esperado = total > 0 ? Math.min(100, Math.max(0, Math.round(((hoje.getTime() - inicio.getTime()) / total) * 100))) : 100;
  const valorEsperado = m.valorInicial + (esperado / 100) * (m.valorAlvo - m.valorInicial);
  const base = { esperado, valorEsperado, foraDoRitmo: false };

  if (m.valorAtual == null) {
    return { ...base, atingido: null, estado: 'A_INICIAR', motivo: 'Ainda sem medição registrada.' };
  }
  const atingido = Math.max(0, Math.round(((m.valorAtual - m.valorInicial) / (m.valorAlvo - m.valorInicial)) * 100));
  if (atingido >= 100) return { ...base, atingido: 100, estado: 'CONCLUIDO', motivo: 'Meta atingida.' };
  if (hoje > prazo) {
    return { ...base, atingido, foraDoRitmo: true, estado: 'ATRASADO', motivo: `Prazo vencido em ${prazo.toLocaleDateString('pt-BR')}.` };
  }
  if (atingido < esperado - MARGEM_RISCO_PONTOS) {
    return { ...base, atingido, foraDoRitmo: true, estado: 'RISCO', motivo: 'Abaixo do ritmo.' };
  }
  return { ...base, atingido, estado: 'ANDAMENTO', motivo: 'No ritmo.' };
}
