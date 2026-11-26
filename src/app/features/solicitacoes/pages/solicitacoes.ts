import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/auth/auth.service';
import { Solicitacao, SolicitacaoService, StatusSolicitacao } from '../services/solicitacao.service';

const ROTULO_STATUS: Record<StatusSolicitacao, string> = {
  PENDENTE: 'Aguardando PMO',
  APROVADA: 'Aprovada',
  RECUSADA: 'Recusada',
};

@Component({
  // Dados chegam da API depois da renderização; sem Eager a tela não atualiza.
  changeDetection: ChangeDetectionStrategy.Eager,
  selector: 'app-solicitacoes',
  imports: [FormsModule, MatIconModule, DatePipe],
  templateUrl: './solicitacoes.html',
  styleUrl: './solicitacoes.scss',
})
export class Solicitacoes implements OnInit {
  minhas: Solicitacao[] = [];
  pendentes: Solicitacao[] = [];
  carregando = true;
  erro = false;

  titulo = '';
  descricao = '';
  enviando = false;
  erroEnvio = '';

  // Justificativa digitada por pedido pendente.
  justificativas: Record<string, string> = {};
  decidindo: string | null = null;
  erroDecisao = '';

  readonly decide: boolean;

  constructor(
    private service: SolicitacaoService,
    auth: AuthService,
  ) {
    this.decide = auth.pode('decidirSolicitacoes');
  }

  ngOnInit() {
    this.service.minhas().subscribe({
      next: (s) => {
        this.minhas = s;
        this.carregando = false;
      },
      error: () => {
        this.carregando = false;
        this.erro = true;
      },
    });
    if (this.decide) {
      this.service.pendentes().subscribe({ next: (s) => (this.pendentes = s), error: () => (this.erro = true) });
    }
  }

  rotuloStatus(s: StatusSolicitacao): string {
    return ROTULO_STATUS[s];
  }

  abrir() {
    const titulo = this.titulo.trim();
    const descricao = this.descricao.trim();
    if (!titulo || !descricao) {
      this.erroEnvio = 'Preencha título e descrição.';
      return;
    }
    this.enviando = true;
    this.erroEnvio = '';
    this.service.abrir(titulo, descricao).subscribe({
      next: (s) => {
        this.minhas = [s, ...this.minhas];
        if (this.decide) this.pendentes = [...this.pendentes, s];
        this.titulo = '';
        this.descricao = '';
        this.enviando = false;
      },
      error: () => {
        this.enviando = false;
        this.erroEnvio = 'Não foi possível enviar a solicitação. Tente de novo.';
      },
    });
  }

  decidir(s: Solicitacao, aprovada: boolean) {
    this.decidindo = s.id;
    this.erroDecisao = '';
    this.service.decidir(s.id, aprovada, (this.justificativas[s.id] ?? '').trim()).subscribe({
      next: (d) => {
        this.pendentes = this.pendentes.filter((p) => p.id !== d.id);
        this.minhas = this.minhas.map((m) => (m.id === d.id ? d : m));
        this.decidindo = null;
      },
      error: () => {
        this.decidindo = null;
        this.erroDecisao = 'Não foi possível registrar a decisão. Recarregue a página e tente de novo.';
      },
    });
  }

  recarregar() {
    location.reload();
  }
}
