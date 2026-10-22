import { ChangeDetectionStrategy, Component, HostListener, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/auth/auth.service';
import { PERFIS, rotuloPerfil } from '../../../core/auth/perfis';
import { Usuario, UsuarioRequest, UsuarioService } from '../services/usuario.service';

type Edicao = UsuarioRequest & { id?: string };

@Component({
  // Dados chegam da API depois da renderização; sem Eager a tela não atualiza.
  changeDetection: ChangeDetectionStrategy.Eager,
  selector: 'app-usuarios',
  imports: [FormsModule, MatIconModule],
  templateUrl: './usuarios.html',
  styleUrl: './usuarios.scss',
})
export class Usuarios implements OnInit {
  usuarios: Usuario[] = [];
  carregando = true;
  erro = false;

  readonly perfis = PERFIS;

  constructor(
    private usuarioService: UsuarioService,
    private auth: AuthService,
  ) {}

  ngOnInit() {
    this.usuarioService.listar().subscribe({
      next: (us) => {
        this.usuarios = us;
        this.carregando = false;
      },
      error: () => {
        this.carregando = false;
        this.erro = true;
      },
    });
  }

  // Ativas primeiro, depois por nome.
  get lista(): Usuario[] {
    return [...this.usuarios].sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome));
  }

  get totalAtivas(): number {
    return this.usuarios.filter((u) => u.ativo).length;
  }

  get gestoresAtivos(): number {
    return this.usuarios.filter((u) => u.ativo && u.perfil === 'GESTOR_PROJETO').length;
  }

  rotuloPerfil(perfil: string): string {
    return rotuloPerfil(perfil);
  }

  // A própria conta não pode perder o perfil de admin nem ser desativada: ninguém ficaria para desfazer.
  ehVoce(u: { login: string }): boolean {
    return u.login === this.auth.sessao()?.username;
  }

  // ---- Edição ----

  edicao: Edicao | null = null;
  salvando = false;
  erroEdicao = '';

  novaConta() {
    this.erroEdicao = '';
    this.edicao = { nome: '', login: '', perfil: 'GESTOR_PROJETO', ativo: true, senha: '' };
  }

  editar(u: Usuario) {
    this.erroEdicao = '';
    const { id, nome, login, perfil, ativo } = u;
    this.edicao = { id, nome, login, perfil, ativo, senha: '' };
  }

  fecharEdicao() {
    this.edicao = null;
  }

  @HostListener('document:keydown.escape')
  aoEsc() {
    this.fecharEdicao();
  }

  salvar() {
    const e = this.edicao;
    if (!e) return;
    const senha = e.senha?.trim() ?? '';
    if (!e.nome.trim() || !e.login.trim()) {
      this.erroEdicao = 'Preencha nome e login.';
      return;
    }
    if (!e.id && !senha) {
      this.erroEdicao = 'Defina uma senha inicial.';
      return;
    }
    if (senha && senha.length < 6) {
      this.erroEdicao = 'A senha precisa ter pelo menos 6 caracteres.';
      return;
    }
    const { id, ...dados } = e;
    const corpo: UsuarioRequest = { ...dados, nome: dados.nome.trim(), login: dados.login.trim(), senha: senha || undefined };
    this.salvando = true;
    this.erroEdicao = '';
    (id ? this.usuarioService.atualizar(id, corpo) : this.usuarioService.criar(corpo)).subscribe({
      next: (salvo) => {
        this.usuarios = id ? this.usuarios.map((u) => (u.id === id ? salvo : u)) : [...this.usuarios, salvo];
        this.salvando = false;
        this.edicao = null;
      },
      error: (err: HttpErrorResponse) => {
        this.salvando = false;
        this.erroEdicao =
          err.status === 409 ? 'Já existe uma conta com esse login.' : 'Não foi possível salvar a conta. Confira os dados e tente de novo.';
      },
    });
  }

  recarregar() {
    location.reload();
  }
}
