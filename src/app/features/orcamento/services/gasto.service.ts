import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Gasto, GastoRequest } from '../models/gasto';

@Injectable({ providedIn: 'root' })
export class GastoService {
  constructor(private http: HttpClient) {}

  doProjeto(projetoId: string): Observable<Gasto[]> {
    return this.http.get<Gasto[]>(`/api/projetos/${projetoId}/gastos`);
  }

  todos(): Observable<Gasto[]> {
    return this.http.get<Gasto[]>('/api/gastos');
  }

  // Origens já usadas, para escolher em vez de redigitar.
  origens(): Observable<string[]> {
    return this.http.get<string[]>('/api/gastos/origens');
  }

  criar(projetoId: string, gasto: GastoRequest): Observable<Gasto> {
    return this.http.post<Gasto>(`/api/projetos/${projetoId}/gastos`, gasto);
  }

  atualizar(projetoId: string, id: string, gasto: GastoRequest): Observable<Gasto> {
    return this.http.put<Gasto>(`/api/projetos/${projetoId}/gastos/${id}`, gasto);
  }

  remover(projetoId: string, id: string): Observable<void> {
    return this.http.delete<void>(`/api/projetos/${projetoId}/gastos/${id}`);
  }
}
