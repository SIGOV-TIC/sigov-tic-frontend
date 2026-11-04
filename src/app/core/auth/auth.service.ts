import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, finalize, tap } from 'rxjs';
import { rotuloPerfil } from './perfis';

export interface Sessao {
  username: string;
  roles: string[];
  // Conta logada; o id é o que liga a pessoa ao projeto como PO ou Scrum Master.
  id?: string;
  nome?: string;
  perfil?: string;
  cargo?: string;
  foto?: string;
}

interface UsuarioResposta {
  id: string;
  nome: string;
  perfil: string;
  cargo?: string | null;
  foto?: string | null;
}

interface RespostaLogin {
  username: string;
  roles: string[];
  usuario?: UsuarioResposta;
}

// O que o usuário edita no próprio perfil.
export interface DadosPerfil {
  nome: string;
  cargo: string | null;
  foto: string | null;
}

// editarProjeto: todos os campos. acompanharProjeto: pontos de atenção, andamento das fases, atualizações e atividades.
export type Acao = 'criarProjeto' | 'editarProjeto' | 'acompanharProjeto' | 'editarMetas' | 'gerenciarUsuarios';

// O que a regra precisa saber do projeto: quem é PO e Scrum Master.
export interface VinculoProjeto {
  po?: { id: string } | null;
  scrumMaster?: { id: string } | null;
}

const CHAVE = 'sigov_sessao';

// O token fica num cookie HttpOnly emitido pela API; aqui só guardamos quem está logado.
@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly sessao = signal<Sessao | null>(this.lerSessao());
  readonly ehAdmin = computed(() => this.sessao()?.roles.includes('ROLE_ADMIN') ?? false);
  readonly ehEscritorio = computed(() => this.sessao()?.roles.includes('ROLE_ESCRITORIO') ?? false);
  readonly rotuloPerfil = computed(() => {
    const s = this.sessao();
    const perfil = s?.perfil ?? s?.roles[0]?.replace(/^ROLE_/, '');
    return perfil ? rotuloPerfil(perfil) : '';
  });

  constructor(private http: HttpClient) {}

  // Mesma regra da API: admin cuida das contas; o Escritório de Projetos cria e edita projetos e metas;
  // PO e Scrum Master acompanham só o próprio projeto.
  pode(acao: Acao, projeto?: VinculoProjeto | null): boolean {
    if (acao === 'gerenciarUsuarios') return this.ehAdmin();
    if (this.ehEscritorio()) return true;
    if (acao !== 'acompanharProjeto' || !projeto) return false;
    const id = this.sessao()?.id;
    return !!id && (projeto.po?.id === id || projeto.scrumMaster?.id === id);
  }

  login(username: string, password: string): Observable<RespostaLogin> {
    return this.http
      .post<RespostaLogin>('/api/auth/login', { username, password })
      .pipe(tap((r) => this.guardar(this.sessaoDe(r))));
  }

  registrar(nome: string, login: string, senha: string): Observable<RespostaLogin> {
    return this.http
      .post<RespostaLogin>('/api/auth/registro', { nome, login, senha })
      .pipe(tap((r) => this.guardar(this.sessaoDe(r))));
  }

  perfilAtual(): Observable<UsuarioResposta> {
    return this.http.get<UsuarioResposta>('/api/users/me');
  }

  // Grava o perfil na API e já reflete o resultado na sessão (menu, avatar).
  atualizarPerfil(dados: DadosPerfil): Observable<UsuarioResposta> {
    return this.http.put<UsuarioResposta>('/api/users/me', dados).pipe(
      tap((u) => {
        const atual = this.sessao();
        if (atual) this.guardar({ ...atual, nome: u.nome, cargo: u.cargo ?? undefined, foto: u.foto ?? undefined });
      }),
    );
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

  private sessaoDe(r: RespostaLogin): Sessao {
    return {
      username: r.username,
      roles: r.roles,
      id: r.usuario?.id,
      nome: r.usuario?.nome,
      perfil: r.usuario?.perfil,
      cargo: r.usuario?.cargo ?? undefined,
      foto: r.usuario?.foto ?? undefined,
    };
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
      const s: Sessao | null = raw ? JSON.parse(raw) : null;
      // Sessões gravadas antes de guardarmos o id da conta pedem um novo login.
      return s?.id ? s : null;
    } catch {
      return null;
    }
  }
}
