import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth.service';

// Mesma regra da API, conferida antes de enviar para a resposta vir na hora.
export function problemaNovaSenha(atual: string, nova: string, confirmacao: string, login: string): string {
  if (!atual) return 'Informe a senha atual.';
  if (nova.length < 8 || new TextEncoder().encode(nova).length > 72) return 'A nova senha deve ter entre 8 e 72 caracteres.';
  if (!/\p{L}/u.test(nova) || !/\p{N}/u.test(nova)) return 'A nova senha deve ter letras e números.';
  if (login && nova.toLowerCase() === login.toLowerCase()) return 'A nova senha não pode ser igual ao login.';
  if (nova === atual) return 'A nova senha deve ser diferente da atual.';
  if (nova !== confirmacao) return 'A confirmação não confere com a nova senha.';
  return '';
}

// A API responde 400 (senha atual errada, com as tentativas que restam, ou regra da nova senha)
// e 429 quando a troca está bloqueada; as duas mensagens já vêm prontas para mostrar.
export function mensagemErroTroca(e: HttpErrorResponse): string {
  if ((e.status === 400 || e.status === 429) && e.error?.message) return e.error.message;
  if (e.status === 0 || e.status >= 500) return 'Não foi possível conectar ao servidor. Tente de novo em alguns segundos.';
  return 'Não foi possível trocar a senha. Tente de novo.';
}

@Component({
  changeDetection: ChangeDetectionStrategy.Eager,
  selector: 'app-form-troca-senha',
  imports: [FormsModule],
  templateUrl: './form-troca-senha.html',
  styleUrl: './form-troca-senha.scss',
})
export class FormTrocaSenha {
  readonly rotuloAtual = input('Senha atual');
  readonly rotuloBotao = input('Trocar senha');
  readonly trocada = output<void>();

  senhaAtual = '';
  novaSenha = '';
  confirmacao = '';
  readonly erro = signal('');
  readonly bloqueada = signal(false);
  readonly concluida = signal(false);
  readonly enviando = signal(false);

  private readonly primeiroCampo = viewChild<ElementRef<HTMLInputElement>>('primeiro');

  constructor(private auth: AuthService) {}

  focar() {
    this.primeiroCampo()?.nativeElement.focus();
  }

  enviar() {
    this.concluida.set(false);
    const problema = problemaNovaSenha(this.senhaAtual, this.novaSenha, this.confirmacao, this.auth.sessao()?.username ?? '');
    if (problema) {
      this.erro.set(problema);
      return;
    }
    this.erro.set('');
    this.enviando.set(true);
    this.auth.trocarSenha(this.senhaAtual, this.novaSenha).subscribe({
      next: () => {
        this.enviando.set(false);
        this.bloqueada.set(false);
        this.senhaAtual = this.novaSenha = this.confirmacao = '';
        this.concluida.set(true);
        this.trocada.emit();
      },
      error: (e: HttpErrorResponse) => {
        this.enviando.set(false);
        this.bloqueada.set(e.status === 429);
        this.erro.set(mensagemErroTroca(e));
      },
    });
  }
}
