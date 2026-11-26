import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type StatusSolicitacao = 'PENDENTE' | 'APROVADA' | 'RECUSADA';

export interface Solicitacao {
  id: string;
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

  abrir(titulo: string, descricao: string): Observable<Solicitacao> {
    return this.http.post<Solicitacao>(this.url, { titulo, descricao });
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
