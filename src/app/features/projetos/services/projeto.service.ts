import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, concat, defer, last, throwError, map, of, shareReplay, switchMap } from 'rxjs';
import { ProjetoRequest, ProjetoResponse, ProjetoPageResponse } from '../models/projeto';
import { PROJETOS_EXEMPLO } from './projetos-exemplo';

@Injectable({ providedIn: 'root' })
export class ProjetoService {
  private static readonly inicial: Observable<void> = of(undefined);
  private readonly url = '/api/projetos';

  // Concluído quando o banco já tem projetos (ou depois de gravar os de exemplo).
  private pronto$: Observable<void> = ProjetoService.inicial;

  constructor(private http: HttpClient) {}

  criar(projeto: ProjetoRequest): Observable<ProjetoResponse> {
    return this.http.post<ProjetoResponse>(this.url, projeto);
  }

  listar(page = 0, size = 20): Observable<ProjetoPageResponse> {
    const params = new HttpParams().set('page', page).set('size', Math.min(size, 100));
    return this.pronto$.pipe(switchMap(() => this.http.get<ProjetoPageResponse>(this.url, { params })));
  }

  obter(id: string): Observable<ProjetoResponse> {
    return this.http.get<ProjetoResponse>(`${this.url}/${id}`);
  }

  atualizar(id: string, projeto: ProjetoRequest): Observable<ProjetoResponse> {
    return this.http.put<ProjetoResponse>(`${this.url}/${id}`, projeto);
  }

  // Grava os projetos de exemplo uma única vez, se o banco estiver vazio.
  seedSeNecessario(): void {
    if (this.pronto$ !== ProjetoService.inicial) return;
    this.pronto$ = defer(() => this.http.get<ProjetoPageResponse>(this.url, { params: { size: 1 } })).pipe(
      switchMap((res) =>
        res.totalElements > 0
          ? of(undefined)
          : concat(...PROJETOS_EXEMPLO.map((p) => this.criar(p))).pipe(last(), map(() => undefined)),
      ),
      catchError((erro) => {
        this.pronto$ = ProjetoService.inicial;
        return throwError(() => erro);
      }),
      shareReplay(1),
    );
  }
}
