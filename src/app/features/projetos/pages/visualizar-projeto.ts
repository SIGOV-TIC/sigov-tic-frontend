import { NgTemplateOutlet } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FaseProjeto, ProjetoResponse, SituacaoFase, StatusProjeto } from '../models/projeto';
import { ProjetoService } from '../services/projeto.service';
import { CORES_FASE, indiceFaseAtual, materializarSituacoes, situacaoFase } from '../utils/fase';

type CampoTexto = 'atualizacoes' | 'pontoAtencao' | 'recomendacao';

@Component({
  selector: 'app-visualizar-projeto',
  imports: [RouterLink, FormsModule, MatIconModule, NgTemplateOutlet],
  templateUrl: './visualizar-projeto.html',
  styleUrl: './visualizar-projeto.scss',
})
export class VisualizarProjeto implements OnInit {
  projeto!: ProjetoResponse;
  carregando = true;
  campoEmEdicao: CampoTexto | null = null;
  textoEdicao = '';
  faseSelecionada: number | null = null;
  editandoFase = false;
  coresFase = CORES_FASE;

  constructor(
    private route: ActivatedRoute,
    private projetoService: ProjetoService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.projetoService.obter(id).subscribe((p) => {
      this.projeto = p;
      this.carregando = false;
    });
  }

  get indiceFaseAtual(): number {
    return indiceFaseAtual(this.projeto);
  }

  situacaoDe(i: number): SituacaoFase {
    return situacaoFase(this.projeto, i);
  }

  corFase(i: number): string {
    return this.coresFase[i % this.coresFase.length];
  }

  situacaoLabel(situacao?: SituacaoFase): string {
    const map: Record<string, string> = { PENDENTE: 'Pendente', EM_ANDAMENTO: 'Em andamento', CONCLUIDA: 'Concluída' };
    return map[situacao || 'PENDENTE'];
  }

  selecionarFase(i: number) {
    this.faseSelecionada = this.faseSelecionada === i ? null : i;
    this.editandoFase = false;
  }

  get faseAberta(): FaseProjeto | null {
    return this.faseSelecionada === null ? null : this.projeto.fases?.[this.faseSelecionada] ?? null;
  }

  ajustarPercentual(fase: FaseProjeto) {
    const valor = Number(fase.percentual);
    fase.percentual = Number.isFinite(valor) ? Math.min(100, Math.max(0, Math.round(valor))) : 0;
  }

  alternarEdicaoFase() {
    materializarSituacoes(this.projeto);
    this.editandoFase = !this.editandoFase;
  }

  salvarFase() {
    const fase = this.faseAberta;
    if (!fase) return;
    materializarSituacoes(this.projeto);
    this.ajustarPercentual(fase);
    this.persistir();
    this.editandoFase = false;
  }

  // Concluir muda o status da fase e libera a próxima.
  concluirFase(i: number) {
    materializarSituacoes(this.projeto);
    const fases = this.projeto.fases ?? [];
    fases[i].situacao = 'CONCLUIDA';
    fases[i].percentual = 100;
    if (fases[i + 1] && fases[i + 1].situacao !== 'CONCLUIDA') {
      fases[i + 1].situacao = 'EM_ANDAMENTO';
      this.faseSelecionada = i + 1;
    }
    this.editandoFase = false;
    this.persistir();
  }

  textoDe(campo: CampoTexto): string | undefined {
    return this.projeto[campo];
  }

  editarCampo(campo: CampoTexto) {
    this.campoEmEdicao = campo;
    this.textoEdicao = this.projeto[campo] ?? '';
  }

  cancelarCampo() {
    this.campoEmEdicao = null;
  }

  salvarCampo() {
    if (!this.campoEmEdicao) return;
    this.projeto[this.campoEmEdicao] = this.textoEdicao.trim() || undefined;
    this.campoEmEdicao = null;
    this.persistir();
    this.snackBar.open('Alterações salvas', 'Fechar', { duration: 4000 });
  }

  private persistir() {
    this.projetoService.atualizar(this.projeto.id, this.projeto).subscribe();
  }

  get percentualDecorrido(): number {
    if (!this.projeto?.dataInicioPrevista || !this.projeto?.dataConclusaoPrevista) return 0;
    const inicio = new Date(this.projeto.dataInicioPrevista).getTime();
    const fim = new Date(this.projeto.dataConclusaoPrevista).getTime();
    const hoje = Date.now();
    if (fim <= inicio) return 0;
    const pct = ((hoje - inicio) / (fim - inicio)) * 100;
    return Math.round(Math.min(100, Math.max(0, pct)));
  }

  get temPrazo(): boolean {
    return !!this.projeto?.dataInicioPrevista && !!this.projeto?.dataConclusaoPrevista;
  }

  get temCusto(): boolean {
    return !!this.projeto?.orcamentoEstimado && this.projeto.custoRealizado != null;
  }

  get percentualCusto(): number {
    if (!this.temCusto) return 0;
    return Math.round((this.projeto.custoRealizado! / this.projeto.orcamentoEstimado!) * 100);
  }

  get percentualCustoAnel(): number {
    return Math.min(100, this.percentualCusto);
  }

  // Compara o gasto com o quanto do prazo já passou.
  get ritmoCusto(): { classe: string; icone: string; texto: string } {
    const folga = this.percentualCusto - this.percentualDecorrido;
    if (folga > 10) {
      return { classe: 'atencao', icone: 'trending_up', texto: `Custo ${folga} p.p. acima do ritmo do prazo` };
    }
    if (folga < -25) {
      return { classe: 'neutro', icone: 'trending_down', texto: 'Execução abaixo do ritmo do prazo' };
    }
    return { classe: 'ok', icone: 'check_circle', texto: 'Custo dentro do ritmo do prazo' };
  }

  formatarData(valor?: string): string {
    if (!valor) return '—';
    const [a, m, d] = valor.split('-');
    return d && m && a ? `${d}/${m}/${a}` : '—';
  }

  formatarCompacto(valor?: number): string {
    if (valor == null) return '—';
    if (valor >= 1_000_000) return 'R$ ' + (valor / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mi';
    if (valor >= 1_000) return 'R$ ' + Math.round(valor / 1_000).toLocaleString('pt-BR') + ' mil';
    return 'R$ ' + valor.toLocaleString('pt-BR');
  }

  get mesesDecorridos(): number {
    if (!this.projeto?.dataInicioPrevista) return 0;
    const inicio = new Date(this.projeto.dataInicioPrevista);
    const hoje = new Date();
    const diff = (hoje.getFullYear() - inicio.getFullYear()) * 12 + (hoje.getMonth() - inicio.getMonth());
    return Math.max(0, diff);
  }

  get mesesTotais(): number {
    if (!this.projeto?.dataInicioPrevista || !this.projeto?.dataConclusaoPrevista) return 0;
    const inicio = new Date(this.projeto.dataInicioPrevista);
    const fim = new Date(this.projeto.dataConclusaoPrevista);
    const diff = (fim.getFullYear() - inicio.getFullYear()) * 12 + (fim.getMonth() - inicio.getMonth());
    return Math.max(0, diff);
  }

  get totalSquad(): number {
    return (this.projeto?.qtdProprios || 0) + (this.projeto?.qtdTerceiros || 0);
  }

  formatarMoeda(valor?: number): string {
    if (!valor) return '—';
    return 'R$ ' + valor.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
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
