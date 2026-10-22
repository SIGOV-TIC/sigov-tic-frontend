import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type Perfil = 'ADMIN' | 'GESTOR_PROJETO' | 'USER';

// Perfis oferecidos na tela; o enum do backend ainda guarda outros, sem uso.
export const PERFIS: { valor: Perfil; rotulo: string; descricao: string }[] = [
  { valor: 'ADMIN', rotulo: 'Administrador', descricao: 'Cria projetos e metas e gerencia contas' },
  { valor: 'GESTOR_PROJETO', rotulo: 'Gestor de projeto', descricao: 'PO ou Scrum Master; edita os projetos a que está vinculado' },
  { valor: 'USER', rotulo: 'Visualizador', descricao: 'Só consulta' },
];

export interface Usuario {
  id: string;
  login: string;
  nome: string;
  perfil: Perfil | string;
  ativo: boolean;
}

export interface UsuarioRequest {
  login: string;
  nome: string;
  perfil: Perfil | string;
  ativo: boolean;
  // Obrigatória ao criar; ao alterar, só vai quando for trocar.
  senha?: string;
}

@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private readonly url = '/api/users';

  constructor(private http: HttpClient) {}

  listar(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(this.url);
  }

  criar(usuario: UsuarioRequest): Observable<Usuario> {
    return this.http.post<Usuario>(this.url, usuario);
  }

  atualizar(id: string, usuario: UsuarioRequest): Observable<Usuario> {
    return this.http.put<Usuario>(`${this.url}/${id}`, usuario);
  }
}
