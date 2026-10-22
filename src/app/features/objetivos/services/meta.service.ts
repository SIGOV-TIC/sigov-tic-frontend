import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// Meta de um objetivo estratégico: indicador, valor e prazo.
export interface Meta {
  id: string;
  objetivo: string;
  indicador: string;
  unidade?: string;
  valorInicial: number;
  valorAlvo: number;
  valorAtual?: number | null;
  dataInicio?: string | null;
  prazo: string;
  responsavel?: string;
  createdAt: string;
  updatedAt: string;
}

export type MetaRequest = Omit<Meta, 'id' | 'createdAt' | 'updatedAt'>;

@Injectable({ providedIn: 'root' })
export class MetaService {
  private readonly url = '/api/metas';

  constructor(private http: HttpClient) {}

  listar(): Observable<Meta[]> {
    return this.http.get<Meta[]>(this.url);
  }

  criar(meta: MetaRequest): Observable<Meta> {
    return this.http.post<Meta>(this.url, meta);
  }

  atualizar(id: string, meta: MetaRequest): Observable<Meta> {
    return this.http.put<Meta>(`${this.url}/${id}`, meta);
  }

  excluir(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
