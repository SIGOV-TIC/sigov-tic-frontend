import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of, shareReplay } from 'rxjs';

// Valores já gravados no banco, para os campos de escolha.
export interface Opcoes {
  areasSolicitantes: string[];
  areasExecutoras: string[];
  pessoas: string[];
  objetivos: string[];
  iniciativas: string[];
  indicadores: string[];
  origensDeGasto: string[];
}

const VAZIAS: Opcoes = {
  areasSolicitantes: [],
  areasExecutoras: [],
  pessoas: [],
  objetivos: [],
  iniciativas: [],
  indicadores: [],
  origensDeGasto: [],
};

@Injectable({ providedIn: 'root' })
export class OpcoesService {
  constructor(private http: HttpClient) {}

  // Sem as opções, os campos seguem aceitando valor novo por "Outro…".
  carregar(): Observable<Opcoes> {
    return this.http.get<Opcoes>('/api/opcoes').pipe(
      catchError(() => of(VAZIAS)),
      shareReplay(1),
    );
  }
}
