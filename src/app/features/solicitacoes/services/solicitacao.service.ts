import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type StatusSolicitacao = 'PENDENTE' | 'APROVADA' | 'RECUSADA';

export type TipoSolicitacao = 'NOVO_PROJETO' | 'ALTERACAO_PROJETO' | 'ACESSO' | 'OUTRO';

export const TIPOS: { valor: TipoSolicitacao; rotulo: string }[] = [
  { valor: 'NOVO_PROJETO', rotulo: 'Novo projeto' },
  { valor: 'ALTERACAO_PROJETO', rotulo: 'Alteração de projeto' },
  { valor: 'ACESSO', rotulo: 'Acesso' },
  { valor: 'OUTRO', rotulo: 'Outro' },
];

export interface NovaSolicitacao {
  tipo: TipoSolicitacao;
  titulo: string;
  descricao: string;
  areaDemandante?: string | null;
  objetivoEstrategico?: string | null;
  poSugerido?: string | null;
  prazoMeses?: number | null;
  custoEstimado?: number | null;
}

export interface Solicitacao {
  id: string;
  tipo?: TipoSolicitacao | null;
  areaDemandante?: string | null;
  objetivoEstrategico?: string | null;
  poSugerido?: string | null;
  prazoMeses?: number | null;
  custoEstimado?: number | null;
  titulo: string;
  descricao: string;
  solicitante: string;
  status: StatusSolicitacao;
  decididoPor?: string | null;
  justificativa?: string | null;
  createdAt: string;
  decididoEm?: string | null;
}

@Injectable({ providedIn: 'root' })
export class SolicitacaoService {
  private readonly url = '/api/solicitacoes';

  constructor(private http: HttpClient) {}

  abrir(pedido: NovaSolicitacao): Observable<Solicitacao> {
    return this.http.post<Solicitacao>(this.url, pedido);
  }

  minhas(): Observable<Solicitacao[]> {
    return this.http.get<Solicitacao[]>(`${this.url}/minhas`);
  }

  pendentes(): Observable<Solicitacao[]> {
    return this.http.get<Solicitacao[]>(`${this.url}/pendentes`);
  }

  decidir(id: string, aprovada: boolean, justificativa: string): Observable<Solicitacao> {
    return this.http.post<Solicitacao>(`${this.url}/${id}/decisao`, { aprovada, justificativa: justificativa || null });
  }
}
