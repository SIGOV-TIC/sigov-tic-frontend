import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ProjetoResponse, StatusProjeto } from '../models/projeto';
import { ProjetoService } from '../services/projeto.service';

@Component({
  selector: 'app-portfolio',
  imports: [FormsModule, RouterLink, MatIconModule],
  templateUrl: './portfolio.html',
  styleUrl: './portfolio.scss',
})
export class Portfolio implements OnInit {
  projetos: ProjetoResponse[] = [];
  projetosFiltrados: ProjetoResponse[] = [];
  busca = '';
  carregando = false;
  erro = '';

  paginaAtual = 0;
  tamanhoPagina = 10;
  totalElementos = 0;
  totalPaginas = 0;

  constructor(private projetoService: ProjetoService) {}

  ngOnInit() {
    this.carregar();
  }

  carregar() {
    this.carregando = true;
    this.erro = '';
    this.projetoService.listar(this.paginaAtual, this.tamanhoPagina).subscribe({
      next: (res) => {
        this.projetos = res.content;
        this.totalElementos = res.totalElements;
        this.totalPaginas = res.totalPages;
        this.filtrar();
        this.carregando = false;
      },
      error: () => {
        this.erro = 'Não foi possível carregar os projetos.';
        this.carregando = false;
      },
    });
  }

  filtrar() {
    if (!this.busca.trim()) {
      this.projetosFiltrados = this.projetos;
      return;
    }
    const termo = this.busca.toLowerCase();
    this.projetosFiltrados = this.projetos.filter(
      (p) =>
        p.nome.toLowerCase().includes(termo) ||
        p.sigla.toLowerCase().includes(termo) ||
        p.areaSolicitante?.toLowerCase().includes(termo)
    );
  }

  paginaAnterior() {
    if (this.paginaAtual > 0) {
      this.paginaAtual--;
      this.carregar();
    }
  }

  proximaPagina() {
    if (this.paginaAtual < this.totalPaginas - 1) {
      this.paginaAtual++;
      this.carregar();
    }
  }

  formatarData(iso: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR');
  }

  statusLabel(status?: StatusProjeto): string {
    const map: Record<string, string> = {
      RASCUNHO: 'Rascunho',
      AGUARDANDO_APROVACAO: 'Aguardando Aprovação',
      APROVADO: 'Aprovado',
      REJEITADO: 'Rejeitado',
    };
    return map[status || ''] || 'Rascunho';
  }

  statusClasse(status?: StatusProjeto): string {
    const map: Record<string, string> = {
      RASCUNHO: 'status-rascunho',
      AGUARDANDO_APROVACAO: 'status-aguardando',
      APROVADO: 'status-aprovado',
      REJEITADO: 'status-rejeitado',
    };
    return map[status || ''] || 'status-rascunho';
  }
}
