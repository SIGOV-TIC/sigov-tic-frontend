import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ProjetoResponse } from '../../projetos/models/projeto';
import { ProjetoService } from '../../projetos/services/projeto.service';
import { MARGEM_RISCO_PONTOS } from '../../projetos/utils/saude';
import { moedaCompacta } from '../../projetos/utils/moeda';
import { analisarCusto, ORDEM_CUSTO, SituacaoCusto, situacaoCusto } from '../../projetos/utils/custo';
import { fatia, Paginacao, paginaNaUrl } from '../../../shared/paginacao/paginacao';

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
  situacao: SituacaoCusto;
  linhas: LinhaOrcamento[];
}

@Component({
  // Dados chegam da API depois da renderização; sem Eager a tela não atualiza.
  changeDetection: ChangeDetectionStrategy.Eager,
  selector: 'app-orcamento',
  imports: [RouterLink, FormsModule, MatIconModule, Paginacao],
  templateUrl: './orcamento.html',
  styleUrl: './orcamento.scss',
})
export class Orcamento implements OnInit {
  projetos: ProjetoResponse[] = [];
  carregando = true;
  erro = false;
  area = '';

  // Áreas abertas na tabela. As que têm projeto fora do previsto abrem sozinhas na primeira carga.
  abertas = new Set<string>();

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
        this.porArea.filter((a) => a.linhas.some((l) => l.situacao !== 'OK')).forEach((a) => this.abertas.add(a.area));
        this.carregando = false;
      },
      error: () => {
        this.carregando = false;
        this.erro = true;
      },
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
        return { area, orcado, gasto, pctGasto, avanco, situacao, linhas: ls };
      })
      .sort((a, b) => ORDEM_CUSTO.indexOf(a.situacao) - ORDEM_CUSTO.indexOf(b.situacao) || b.orcado - a.orcado);
  }

  // Áreas paginam pela URL; os projetos de cada área têm a própria página, guardada só enquanto a tela está aberta.
  readonly tamanhoAreas = 8;
  readonly tamanhoProjetos = 5;
  readonly pagina = paginaNaUrl();
  private paginaProjetos = new Map<string, number>();

  areasDaPagina(areas: LinhaArea[]): { itens: LinhaArea[]; atual: number } {
    const atual = this.pagina.em(areas.length, this.tamanhoAreas);
    return { itens: fatia(areas, atual, this.tamanhoAreas), atual };
  }

  projetosDaArea(a: LinhaArea): { itens: LinhaOrcamento[]; atual: number } {
    const atual = this.paginaProjetos.get(a.area) ?? 1;
    return { itens: fatia(a.linhas, atual, this.tamanhoProjetos), atual };
  }

  irProjetos(area: string, pagina: number) {
    this.paginaProjetos.set(area, pagina);
  }

  trocarArea() {
    this.paginaProjetos.clear();
    this.pagina.ir(1);
  }

  alternar(area: string) {
    if (this.abertas.has(area)) this.abertas.delete(area);
    else this.abertas.add(area);
  }

  get todasAbertas(): boolean {
    const areas = this.porArea;
    return areas.length > 0 && areas.every((a) => this.abertas.has(a.area));
  }

  alternarTodas() {
    if (this.todasAbertas) this.abertas.clear();
    else this.porArea.forEach((a) => this.abertas.add(a.area));
  }

  // ---- Formatação ----

  moeda(valor: number): string {
    return moedaCompacta(valor);
  }

  largura(pct: number): number {
    return Math.max(0, Math.min(100, pct));
  }

  recarregar() {
    location.reload();
  }
}
