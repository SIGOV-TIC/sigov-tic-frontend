import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// Situação do portfólio em um dia; a sequência dá a tendência do painel.
export interface Retrato {
  data: string;
  prazoOk: number;
  prazoTotal: number;
  custoOk: number;
  custoTotal: number;
  metasOk: number;
  metasTotal: number;
  alertas: number;
}

@Injectable({ providedIn: 'root' })
export class RetratoService {
  private readonly url = '/api/retratos';

  constructor(private http: HttpClient) {}

  listar(dias = 120): Observable<Retrato[]> {
    return this.http.get<Retrato[]>(this.url, { params: { dias } });
  }

  registrarHoje(r: Omit<Retrato, 'data'>): Observable<Retrato> {
    return this.http.put<Retrato>(`${this.url}/hoje`, r);
  }
}
