import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Perfil } from '../../../core/auth/perfis';

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

  // Gestores ativos, os que podem ser PO ou Scrum Master; aberto a qualquer conta logada.
  gestores(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(`${this.url}/gestores`);
  }

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
