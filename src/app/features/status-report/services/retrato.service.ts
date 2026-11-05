import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Retrato } from '../models/retrato';

@Injectable({ providedIn: 'root' })
export class RetratoService {
  private readonly url = '/api/retratos-quinzenais';

  constructor(private http: HttpClient) {}

  // Histórico do projeto, da quinzena mais recente para a mais antiga.
  porProjeto(projetoId: string): Observable<Retrato[]> {
    return this.http.get<Retrato[]>(this.url, { params: new HttpParams().set('projeto', projetoId) });
  }

  emitir(projetoId: string, dia: string): Observable<Retrato> {
    const params = new HttpParams().set('projeto', projetoId).set('dia', dia);
    return this.http.post<Retrato>(this.url, null, { params });
  }
}
