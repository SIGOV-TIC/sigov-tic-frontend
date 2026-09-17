import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { ProjetoRequest, ProjetoResponse, ProjetoPageResponse } from '../models/projeto';

@Injectable({ providedIn: 'root' })
export class ProjetoService {
  // TODO: trocar para HttpClient quando o backend estiver disponível
  // private readonly url = 'http://localhost:8080/api/projetos';

  private getStorage(): ProjetoResponse[] {
    const raw = localStorage.getItem('projetos_mock');
    return raw ? JSON.parse(raw) : [];
  }

  private setStorage(projetos: ProjetoResponse[]) {
    localStorage.setItem('projetos_mock', JSON.stringify(projetos));
  }

  criar(projeto: ProjetoRequest): Observable<ProjetoResponse> {
    const projetos = this.getStorage();
    const novo: ProjetoResponse = {
      ...projeto,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    projetos.push(novo);
    this.setStorage(projetos);
    return of(novo);
  }

  listar(page = 0, size = 20): Observable<ProjetoPageResponse> {
    const todos = this.getStorage();
    const start = page * size;
    const content = todos.slice(start, start + size);
    return of({
      content,
      page,
      size,
      totalElements: todos.length,
      totalPages: Math.ceil(todos.length / size) || 1,
    });
  }

  obter(id: string): Observable<ProjetoResponse> {
    const projeto = this.getStorage().find(p => p.id === id);
    return of(projeto!);
  }

  atualizar(id: string, projeto: ProjetoRequest): Observable<ProjetoResponse> {
    const projetos = this.getStorage();
    const idx = projetos.findIndex(p => p.id === id);
    if (idx >= 0) {
      projetos[idx] = { ...projetos[idx], ...projeto, updatedAt: new Date().toISOString() };
      this.setStorage(projetos);
      return of(projetos[idx]);
    }
    return of(null as any);
  }
}
