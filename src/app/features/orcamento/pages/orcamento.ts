import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ProjetoResponse } from '../../projetos/models/projeto';
import { ProjetoService } from '../../projetos/services/projeto.service';
import { MARGEM_RISCO_PONTOS } from '../../projetos/utils/saude';
import { analisarCusto, ORDEM_CUSTO, SituacaoCusto, situacaoCusto } from '../../projetos/utils/custo';

interface LinhaOrcamento {
  projeto: ProjetoResponse;
  orcado: number;
  gasto: number;
  saldo: number;
  pctGasto: number;
  avanco: number;
  situacao: SituacaoCusto;
  motivo: string;
}

interface LinhaArea {
  area: string;
  orcado: number;
  gasto: number;
  pctGasto: number;
  avanco: number;
  projetos: number;
  situacao: SituacaoCusto;
}

@Component({
  selector: 'app-orcamento',
  imports: [RouterLink, FormsModule, MatIconModule],
  templateUrl: './orcamento.html',
  styleUrl: './orcamento.scss',
})
export class Orcamento implements OnInit {
  projetos: ProjetoResponse[] = [];
  carregando = true;
  area = '';

  readonly margem = MARGEM_RISCO_PONTOS;

  readonly rotulos: Record<SituacaoCusto, string> = {
    ESTOURADO: 'Acima do orçado',
    ALERTA: 'Gasto à frente do avanço',
    OK: 'Dentro do previsto',
  };

  readonly icones: Record<SituacaoCusto, string> = {
    ESTOURADO: 'error',
    ALERTA: 'warning',
    OK: 'check_circle',
  };

  constructor(private projetoService: ProjetoService) {}

  ngOnInit() {
    this.projetoService.seedSeNecessario();
    this.projetoService.listar(0, 200).subscribe({
      next: (res) => {
        this.projetos = res.content;
        this.carregando = false;
      },
      error: () => (this.carregando = false),
    });
  }

  get areas(): string[] {
    return [...new Set(this.projetos.map((p) => p.areaSolicitante || 'Sem área'))].sort();
  }

  // Só entram projetos com orçamento informado; os demais são contados à parte.
  private get comOrcamento(): ProjetoResponse[] {
    return this.projetos.filter(
      (p) => (p.orcamentoEstimado ?? 0) > 0 && (!this.area || (p.areaSolicitante || 'Sem área') === this.area),
    );
  }

  get semOrcamento(): number {
    return this.projetos.filter(
      (p) => !((p.orcamentoEstimado ?? 0) > 0) && (!this.area || (p.areaSolicitante || 'Sem área') === this.area),
    ).length;
  }

  get linhas(): LinhaOrcamento[] {
    return this.comOrcamento
      .map((p) => this.montar(p))
      .sort((a, b) => ORDEM_CUSTO.indexOf(a.situacao) - ORDEM_CUSTO.indexOf(b.situacao) || b.orcado - a.orcado);
  }

  get atencao(): LinhaOrcamento[] {
    return this.linhas.filter((l) => l.situacao !== 'OK');
  }

  private montar(p: ProjetoResponse): LinhaOrcamento {
    const c = analisarCusto(p)!;
    let motivo = `Gastou ${c.pctGasto}% do orçado, com ${c.avanco}% de avanço.`;
    if (c.situacao === 'ESTOURADO') {
      motivo = `Gastou ${this.moeda(c.gasto - c.orcado)} além do orçado (${c.pctGasto}% do previsto).`;
    } else if (c.situacao === 'ALERTA') {
      motivo = `Gastou ${c.pctGasto}% do orçado, mas o avanço é de ${c.avanco}%.`;
    }
    return { projeto: p, ...c, motivo };
  }

  // ---- Totais ----

  get totalOrcado(): number {
    return this.linhas.reduce((a, l) => a + l.orcado, 0);
  }

  get totalGasto(): number {
    return this.linhas.reduce((a, l) => a + l.gasto, 0);
  }

  get saldo(): number {
    return this.totalOrcado - this.totalGasto;
  }

  get execucao(): number {
    return this.totalOrcado ? Math.round((this.totalGasto / this.totalOrcado) * 100) : 0;
  }

  // ---- Por área ----

  get porArea(): LinhaArea[] {
    const mapa = new Map<string, LinhaOrcamento[]>();
    this.linhas.forEach((l) => {
      const area = l.projeto.areaSolicitante || 'Sem área';
      mapa.set(area, [...(mapa.get(area) ?? []), l]);
    });
    return [...mapa.entries()]
      .map(([area, ls]) => {
        const orcado = ls.reduce((a, l) => a + l.orcado, 0);
        const gasto = ls.reduce((a, l) => a + l.gasto, 0);
        // Avanço da área = média do avanço dos projetos, ponderada pelo orçamento.
        const avanco = Math.round(ls.reduce((a, l) => a + l.avanco * l.orcado, 0) / orcado);
        const pctGasto = Math.round((gasto / orcado) * 100);
        const situacao = situacaoCusto(orcado, gasto, avanco);
        return { area, orcado, gasto, pctGasto, avanco, projetos: ls.length, situacao };
      })
      .sort((a, b) => ORDEM_CUSTO.indexOf(a.situacao) - ORDEM_CUSTO.indexOf(b.situacao) || b.orcado - a.orcado);
  }

  // ---- Formatação ----

  moeda(valor: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(valor);
  }

  largura(pct: number): number {
    return Math.max(0, Math.min(100, pct));
  }
}
