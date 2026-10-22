import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, finalize, tap } from 'rxjs';

export interface Sessao {
  username: string;
  roles: string[];
}

const CHAVE = 'sigov_sessao';

// O token fica num cookie HttpOnly emitido pela API; aqui só guardamos quem está logado.
@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly sessao = signal<Sessao | null>(this.lerSessao());
  readonly ehAdmin = computed(() => this.sessao()?.roles.includes('ROLE_ADMIN') ?? false);

  constructor(private http: HttpClient) {}

  login(username: string, password: string): Observable<Sessao> {
    return this.http
      .post<Sessao>('/api/auth/login', { username, password })
      .pipe(tap((s) => this.guardar({ username: s.username, roles: s.roles })));
  }

  registrar(nome: string, login: string, senha: string): Observable<Sessao> {
    return this.http
      .post<Sessao>('/api/auth/registro', { nome, login, senha })
      .pipe(tap((s) => this.guardar({ username: s.username, roles: s.roles })));
  }

  logout(): Observable<void> {
    return this.http.post<void>('/api/auth/logout', {}).pipe(finalize(() => this.encerrar()));
  }

  // Sessão expirada ou recusada pela API.
  encerrar() {
    try {
      localStorage.removeItem(CHAVE);
    } catch {}
    this.sessao.set(null);
  }

  private guardar(s: Sessao) {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(s));
    } catch {}
    this.sessao.set(s);
  }

  private lerSessao(): Sessao | null {
    try {
      const raw = localStorage.getItem(CHAVE);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
