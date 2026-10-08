import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ProjetoResponse, StatusProjeto } from '../../projetos/models/projeto';
import { ProjetoService } from '../../projetos/services/projeto.service';
import { Estado, ICONE_ESTADO, ROTULO_ESTADO, estadoProjeto } from '../../projetos/utils/saude';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, MatIconModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  projetos: ProjetoResponse[] = [];
  carregando = true;

  constructor(private projetoService: ProjetoService) {}

  ngOnInit() {
    this.projetoService.seedSeNecessario();
    this.projetoService.listar(0, 100).subscribe({
      next: (res) => {
        this.projetos = res.content;
        this.carregando = false;
      },
      error: () => {
        this.carregando = false;
      },
    });
  }

  get projetosAtivos(): number {
    return this.projetos.filter(p => p.status !== 'REJEITADO').length;
  }

  get projetosNovos(): number {
    return this.projetos.filter(p => p.status === 'RASCUNHO').length;
  }

  get orcamentoTotal(): number {
    return this.projetos.reduce((acc, p) => acc + (p.orcamentoEstimado || 0), 0);
  }

  get orcamentoExecutado(): number {
    return this.projetos.reduce((acc, p) => acc + (p.custoRealizado || 0), 0);
  }

  // Mesma regra do Cronograma, para os números não se contradizerem entre as telas.
  get projetosEmAtraso(): number {
    return this.projetos.filter((p) => p.status !== 'REJEITADO' && estadoProjeto(p) === 'ATRASADO').length;
  }

  get projetosEmRisco(): number {
    return this.projetos.filter((p) => p.status !== 'REJEITADO' && estadoProjeto(p) === 'RISCO').length;
  }

  mostrarTodasAreas = false;

  get todasAreas(): { area: string; quantidade: number; percentual: number }[] {
    const mapa = new Map<string, number>();
    this.projetos.forEach(p => {
      const area = p.areaSolicitante || 'Sem área';
      mapa.set(area, (mapa.get(area) || 0) + 1);
    });
    const total = this.projetos.length || 1;
    return Array.from(mapa.entries())
      .map(([area, quantidade]) => ({ area, quantidade, percentual: Math.round((quantidade / total) * 100) }))
      .sort((a, b) => b.quantidade - a.quantidade);
  }

  get distribuicaoPorArea(): { area: string; quantidade: number; percentual: number }[] {
    const todas = this.todasAreas;
    if (todas.length <= 5) return todas;
    const top4 = todas.slice(0, 4);
    const resto = todas.slice(4);
    const qtdOutras = resto.reduce((acc, r) => acc + r.quantidade, 0);
    const pctOutras = resto.reduce((acc, r) => acc + r.percentual, 0);
    return [...top4, { area: `Outras (${resto.length} áreas)`, quantidade: qtdOutras, percentual: pctOutras }];
  }

  get temOutrasAreas(): boolean {
    return this.todasAreas.length > 5;
  }

  get totalDistribuicao(): number {
    return this.projetos.length;
  }

  areaDestacada: number | null = null;

  // Comprimento do círculo = 100 (r = 15.915), então cada unidade equivale a 1% do anel.
  get arcosDonut(): { comprimento: number; inicio: number }[] {
    const dist = this.distribuicaoPorArea;
    const total = this.totalDistribuicao || 1;
    const folga = dist.length > 1 ? 1.2 : 0;
    let acumulado = 0;
    return dist.map(item => {
      const fatia = (item.quantidade / total) * 100;
      const arco = { comprimento: Math.max(fatia - folga, 0.1), inicio: -(acumulado + folga / 2) };
      acumulado += fatia;
      return arco;
    });
  }

  get valorCentro(): number {
    return this.areaDestacada === null ? this.totalDistribuicao : this.distribuicaoPorArea[this.areaDestacada].quantidade;
  }

  get rotuloCentro(): string {
    return this.areaDestacada === null ? 'projetos' : this.distribuicaoPorArea[this.areaDestacada].percentual + '% do portfólio';
  }

  get top5PorInvestimento(): ProjetoResponse[] {
    return [...this.projetos]
      .sort((a, b) => (b.orcamentoEstimado || 0) - (a.orcamentoEstimado || 0))
      .slice(0, 5);
  }

  get cronogramaConsolidado(): { nome: string; sigla: string; trimestres: boolean[]; estado: Estado }[] {
    return this.top5PorInvestimento.map(p => {
      const trimestres = [false, false, false, false];
      if (p.dataInicioPrevista && p.dataConclusaoPrevista) {
        const inicio = new Date(p.dataInicioPrevista);
        const fim = new Date(p.dataConclusaoPrevista);
        for (let q = 0; q < 4; q++) {
          const qInicio = new Date(new Date().getFullYear(), q * 3, 1);
          const qFim = new Date(new Date().getFullYear(), (q + 1) * 3, 0);
          if (inicio <= qFim && fim >= qInicio) {
            trimestres[q] = true;
          }
        }
      }
      return { nome: p.nome, sigla: p.sigla, trimestres, estado: estadoProjeto(p) };
    });
  }

  percentualExecutado(projeto: ProjetoResponse): number {
    if (!projeto.orcamentoEstimado || projeto.orcamentoEstimado === 0) return 0;
    return Math.round(((projeto.custoRealizado || 0) / projeto.orcamentoEstimado) * 100);
  }

  formatarMoeda(valor: number): string {
    if (!valor) return 'R$ 0';
    if (valor >= 1000000) return 'R$ ' + (valor / 1000000).toFixed(1) + 'M';
    if (valor >= 1000) return 'R$ ' + (valor / 1000).toFixed(0) + 'K';
    return 'R$ ' + valor.toLocaleString('pt-BR');
  }

  // Situação de prazo calculada (mesma regra do Cronograma); rascunho ainda não tem prazo a acompanhar.
  situacaoDe(p: ProjetoResponse): { estado: Estado; rotulo: string; icone: string } | null {
    if (p.status === 'RASCUNHO') return null;
    const estado = estadoProjeto(p);
    return { estado, rotulo: ROTULO_ESTADO[estado], icone: ICONE_ESTADO[estado] };
  }

  statusLabel(status?: StatusProjeto): string {
    const map: Record<string, string> = {
      RASCUNHO: 'Rascunho',
      AGUARDANDO_APROVACAO: 'Aguardando',
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
