import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LinhaFato, Recorte, Retrato } from '../models/retrato';

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

  // Dados brutos: uma linha por fato, com o mesmo recorte que a tela mostra.
  fatos(recorte: Recorte): Observable<LinhaFato[]> {
    return this.http.get<LinhaFato[]>(`${this.url}/fatos`, { params: parametros(recorte) });
  }

  csv(recorte: Recorte): Observable<Blob> {
    return this.http.get(`${this.url}/fatos.csv`, { params: parametros(recorte), responseType: 'blob' });
  }

  areas(): Observable<string[]> {
    return this.http.get<string[]>(`${this.url}/areas`);
  }
}

function parametros(recorte: Recorte): HttpParams {
  let params = new HttpParams();
  if (recorte.projeto) params = params.set('projeto', recorte.projeto);
  if (recorte.area) params = params.set('area', recorte.area);
  if (recorte.de) params = params.set('de', recorte.de);
  if (recorte.ate) params = params.set('ate', recorte.ate);
  for (const m of recorte.metricas ?? []) params = params.append('metrica', m);
  return params;
}
