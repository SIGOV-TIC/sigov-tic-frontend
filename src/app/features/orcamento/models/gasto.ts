// Gasto realizado num mês: quanto, por que e de onde veio. O realizado do projeto é a soma.
export interface Gasto {
  id: string;
  projetoId: string;
  // 'aaaa-mm'
  mes: string;
  valor: number;
  motivo: string;
  origem: string;
  autor?: string | null;
  atualizadoEm?: string;
}

export interface GastoRequest {
  mes: string;
  valor: number;
  motivo: string;
  origem: string;
}
