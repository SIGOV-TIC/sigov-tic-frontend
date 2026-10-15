import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  modo: 'entrar' | 'cadastrar' = 'entrar';
  nome = '';
  usuario = '';
  senha = '';
  readonly entrando = signal(false);
  readonly erro = signal('');

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  alternarModo() {
    this.modo = this.modo === 'entrar' ? 'cadastrar' : 'entrar';
    this.erro.set('');
  }

  enviar() {
    const cadastro = this.modo === 'cadastrar';
    if ((cadastro && !this.nome.trim()) || !this.usuario.trim() || !this.senha) {
      this.erro.set(cadastro ? 'Preencha nome, usuário e senha.' : 'Informe usuário e senha.');
      return;
    }
    if (cadastro && this.senha.length < 8) {
      this.erro.set('A senha precisa ter pelo menos 8 caracteres.');
      return;
    }
    this.entrando.set(true);
    this.erro.set('');
    const pedido = cadastro
      ? this.auth.registrar(this.nome.trim(), this.usuario.trim(), this.senha)
      : this.auth.login(this.usuario.trim(), this.senha);
    pedido.subscribe({
      next: () => {
        const voltar = this.route.snapshot.queryParamMap.get('voltar');
        this.router.navigateByUrl(voltar && voltar.startsWith('/') && !voltar.startsWith('/login') ? voltar : '/dashboard');
      },
      error: (e: HttpErrorResponse) => {
        this.erro.set(this.mensagemErro(e, cadastro));
        this.entrando.set(false);
      },
    });
  }

  private mensagemErro(e: HttpErrorResponse, cadastro: boolean): string {
    if (e.status === 0 || e.status >= 500) return 'Não foi possível conectar ao servidor. Tente de novo em alguns segundos.';
    if (cadastro && e.status === 409) return 'Esse usuário já existe. Escolha outro.';
    if (cadastro) return 'Não foi possível criar a conta. Confira os dados.';
    return 'Usuário ou senha incorretos.';
  }
}
