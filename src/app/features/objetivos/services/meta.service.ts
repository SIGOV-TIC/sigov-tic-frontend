import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type CicloMeta = 'ANUAL' | 'QUADRIENAL';

// Linha da meta financeira: quantidade, unidade e valor de cada unidade (ex.: 2 contratos de R$ 500 mil).
export interface ItemFinanceiro {
  quantidade: number;
  unidade: string;
  valorUnitario: number;
  total?: number;
}

// Meta de um objetivo estratégico: indicador e valor, lida pelo ano do plano.
export interface Meta {
  id: string;
  objetivo: string;
  indicador: string;
  unidade?: string;
  valorInicial: number;
  valorAlvo: number;
  valorAtual?: number | null;
  dataInicio?: string | null;
  // Opcional: sem prazo, a meta vence no fim do ciclo.
  prazo?: string | null;
  responsavel?: string;
  // Ano do plano; no ciclo quadrienal, o primeiro dos quatro anos.
  ano: number;
  ciclo: CicloMeta;
  itensFinanceiros: ItemFinanceiro[];
  valorFinanceiroTotal?: number;
  createdAt: string;
  updatedAt: string;
}

export type MetaRequest = Omit<Meta, 'id' | 'createdAt' | 'updatedAt' | 'valorFinanceiroTotal'>;

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
