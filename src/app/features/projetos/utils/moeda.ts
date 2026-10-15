// Formato único de valores em reais nas telas de resumo: "R$ 9,4 mi", "R$ 710 mil".
export function moedaCompacta(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(valor || 0);
}
