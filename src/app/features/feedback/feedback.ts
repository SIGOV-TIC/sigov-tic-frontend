import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Feedback as ItemFeedback, FeedbackService } from '../../core/feedback/feedback.service';

// Lista do que quem usa o sistema escreveu, do mais recente para o mais antigo.
@Component({
  selector: 'app-feedback',
  imports: [FormsModule, RouterLink],
  templateUrl: './feedback.html',
  styleUrl: './feedback.scss',
})
export class FeedbackPagina implements OnInit {
  readonly itens = signal<ItemFeedback[]>([]);
  readonly carregando = signal(true);
  readonly erro = signal(false);
  tela = '';

  constructor(private feedback: FeedbackService) {}

  ngOnInit() {
    this.feedback.listar().subscribe({
      next: (lista) => {
        this.itens.set(lista);
        this.carregando.set(false);
      },
      error: () => {
        this.carregando.set(false);
        this.erro.set(true);
      },
    });
  }

  get telas(): string[] {
    return [...new Set(this.itens().map((f) => f.tela || '—'))].sort();
  }

  get filtrados(): ItemFeedback[] {
    return this.itens().filter((f) => !this.tela || (f.tela || '—') === this.tela);
  }

  quando(iso: string): string {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  recarregar() {
    location.reload();
  }
}
