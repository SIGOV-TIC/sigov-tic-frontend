import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ProjetoResponse, StatusProjeto } from '../models/projeto';
import { ProjetoService } from '../services/projeto.service';
import { moedaCompacta } from '../utils/moeda';
import { calcularDesvio, Desvio, TOLERANCIA_DESVIO } from '../utils/desvio';

@Component({
  // Dados chegam da API depois da renderização; sem Eager a tela não atualiza.
  changeDetection: ChangeDetectionStrategy.Eager,
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
    this.projetoService.seedSeNecessario();
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

  formatarData(iso?: string): string {
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

  percentualDecorrido(projeto: ProjetoResponse): number | null {
    if (!projeto.dataInicioPrevista || !projeto.dataConclusaoPrevista) return null;
    const inicio = new Date(projeto.dataInicioPrevista).getTime();
    const fim = new Date(projeto.dataConclusaoPrevista).getTime();
    if (fim <= inicio) return 0;
    const pct = ((Date.now() - inicio) / (fim - inicio)) * 100;
    return Math.round(Math.min(100, Math.max(0, pct)));
  }

  moeda(valor: number): string {
    return moedaCompacta(valor);
  }

  mesAno(iso?: string): string {
    if (!iso) return '—';
    return new Date(iso.slice(0, 10) + 'T00:00').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '').replace(' de ', '/');
  }

  percentualGasto(projeto: ProjetoResponse): number | null {
    if (!projeto.orcamentoEstimado) return null;
    return Math.round(((projeto.custoRealizado || 0) / projeto.orcamentoEstimado) * 100);
  }

  formatarMoeda(valor?: number): string {
    if (!valor) return '—';
    return 'R$ ' + valor.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  get totalOrcamento(): number {
    return this.projetosFiltrados.reduce((acc, p) => acc + (p.orcamentoEstimado || 0), 0);
  }

  get totalRealizado(): number {
    return this.projetosFiltrados.reduce((acc, p) => acc + (p.custoRealizado || 0), 0);
  }

  get totalProprios(): number {
    return this.projetosFiltrados.reduce((acc, p) => acc + (p.qtdProprios || 0), 0);
  }

  readonly tolerancia = TOLERANCIA_DESVIO;

  desvio(projeto: ProjetoResponse): Desvio {
    return calcularDesvio(projeto);
  }

  formatarIndice(valor: number | null): string {
    return valor == null ? '—' : valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  formatarDesvio(valor: number): string {
    const arred = Math.round(valor);
    return (arred > 0 ? '+' : '') + arred + '%';
  }

  get foraDaFaixa(): number {
    return this.projetosFiltrados.filter((p) => calcularDesvio(p).dentro === false).length;
  }

  get totalTerceiros(): number {
    return this.projetosFiltrados.reduce((acc, p) => acc + (p.qtdTerceiros || 0), 0);
  }
}
