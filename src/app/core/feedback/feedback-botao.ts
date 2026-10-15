import { Component, HostListener, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { FeedbackService } from './feedback.service';

// Botão fixo no canto da tela: caixa de texto livre; a tela atual vai junto.
@Component({
  selector: 'app-feedback-botao',
  imports: [FormsModule, MatIconModule],
  templateUrl: './feedback-botao.html',
  styleUrl: './feedback-botao.scss',
})
export class FeedbackBotao {
  readonly aberto = signal(false);
  readonly enviando = signal(false);
  readonly enviado = signal(false);
  readonly erro = signal('');
  texto = '';

  constructor(
    private feedback: FeedbackService,
    private router: Router,
  ) {}

  get tela(): string {
    return this.router.url.split('?')[0];
  }

  abrir() {
    this.aberto.set(true);
    this.enviado.set(false);
    this.erro.set('');
  }

  fechar() {
    this.aberto.set(false);
  }

  @HostListener('document:keydown.escape')
  aoEsc() {
    this.fechar();
  }

  enviar() {
    const texto = this.texto.trim();
    if (!texto) return;
    let tema = 'dark';
    try {
      tema = localStorage.getItem('sigov_tema') || 'dark';
    } catch {}
    this.enviando.set(true);
    this.erro.set('');
    this.feedback.enviar(texto, this.tela, tema).subscribe({
      next: () => {
        this.texto = '';
        this.enviando.set(false);
        this.enviado.set(true);
      },
      error: () => {
        this.enviando.set(false);
        this.erro.set('Não foi possível enviar. Tente de novo.');
      },
    });
  }
}
