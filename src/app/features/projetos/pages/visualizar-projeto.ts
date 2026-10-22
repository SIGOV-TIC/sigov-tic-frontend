import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FaseProjeto, ProjetoResponse, SituacaoFase, StatusProjeto } from '../models/projeto';
import { ProjetoService } from '../services/projeto.service';
import { AuthService } from '../../../core/auth/auth.service';
import { indiceFaseAtual, janelaFase, materializarSituacoes, situacaoFase } from '../utils/fase';
import { MARGEM_RISCO_PONTOS } from '../utils/saude';

type CampoTexto = 'atualizacoes' | 'pontoAtencao' | 'recomendacao';

@Component({
  // Dados chegam da API depois da renderização; sem Eager a tela não atualiza.
  changeDetection: ChangeDetectionStrategy.Eager,
  selector: 'app-visualizar-projeto',
  imports: [RouterLink, FormsModule, MatIconModule, NgTemplateOutlet],
  templateUrl: './visualizar-projeto.html',
  styleUrl: './visualizar-projeto.scss',
})
export class VisualizarProjeto implements OnInit {
  projeto!: ProjetoResponse;
  carregando = true;
  erro = false;
  campoEmEdicao: CampoTexto | null = null;
  textoEdicao = '';
  // Fase aberta na camada de detalhe; `rascunhoFase` é a cópia em edição, para Cancelar desfazer.
  faseSelecionada: number | null = null;
  editandoFase = false;
  rascunhoFase: FaseProjeto | null = null;
  // Ponto de onde a camada cresce: o centro da bolinha clicada.
  origemFase = { x: 0, y: 0 };

  constructor(
    private route: ActivatedRoute,
    private projetoService: ProjetoService,
    private snackBar: MatSnackBar,
    private auth: AuthService,
  ) {}

  // Quem não pode editar vê o projeto e as fases só para leitura.
  get podeEditar(): boolean {
    return this.auth.pode('editarProjeto', this.projeto);
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.projetoService.obter(id).subscribe({
      next: (p) => {
        this.projeto = p;
        this.preencherDatasPlanejadas();
        this.carregando = false;
      },
      error: () => {
        this.carregando = false;
        this.erro = true;
      },
    });
  }

  get indiceFaseAtual(): number {
    return indiceFaseAtual(this.projeto);
  }

  situacaoDe(i: number): SituacaoFase {
    return situacaoFase(this.projeto, i);
  }

  situacaoLabel(situacao?: SituacaoFase): string {
    const map: Record<string, string> = { PENDENTE: 'Pendente', EM_ANDAMENTO: 'Em andamento', CONCLUIDA: 'Concluída' };
    return map[situacao || 'PENDENTE'];
  }

  abrirFase(i: number, evento: MouseEvent) {
    const r = (evento.currentTarget as HTMLElement).querySelector('.fase-circle')!.getBoundingClientRect();
    // getBoundingClientRect já vem na escala da página; a camada é posicionada em pixels de CSS.
    const escala = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
    this.origemFase = { x: (r.left + r.width / 2) / escala, y: (r.top + r.height / 2) / escala };
    this.mostrarFase(i);
  }

  private mostrarFase(i: number) {
    this.faseSelecionada = i;
    this.editandoFase = false;
    this.rascunhoFase = null;
    this.erroFase = '';
  }

  fecharFase() {
    this.faseSelecionada = null;
    this.editandoFase = false;
    this.rascunhoFase = null;
  }

  irParaFase(passo: number) {
    const i = (this.faseSelecionada ?? 0) + passo;
    if (!this.editandoFase && i >= 0 && i < (this.projeto.fases?.length ?? 0)) this.mostrarFase(i);
  }

  @HostListener('document:keydown', ['$event'])
  aoTeclar(e: KeyboardEvent) {
    if (this.faseSelecionada === null) return;
    if (e.key === 'Escape') this.editandoFase ? this.cancelarEdicaoFase() : this.fecharFase();
    else if (e.key === 'ArrowLeft') this.irParaFase(-1);
    else if (e.key === 'ArrowRight') this.irParaFase(1);
  }

  get faseAberta(): FaseProjeto | null {
    return this.faseSelecionada === null ? null : this.projeto.fases?.[this.faseSelecionada] ?? null;
  }

  // Leitura da fase aberta: janela, tempo decorrido e se o concluído ficou para trás.
  get leituraFase(): { ini: string; fim: string; tempo: number | null; hoje: number | null; atrasada: boolean } | null {
    const i = this.faseSelecionada;
    const fase = this.faseAberta;
    if (i === null || !fase) return null;
    const janela = janelaFase(this.projeto, i);
    const andamento = this.situacaoDe(i) === 'EM_ANDAMENTO';
    let tempo: number | null = null;
    if (janela && andamento) {
      const total = janela.fim.getTime() - janela.ini.getTime();
      tempo = Math.round(Math.min(100, Math.max(0, ((Date.now() - janela.ini.getTime()) / total) * 100)));
    }
    return {
      ini: this.formatarData(fase.dataInicio),
      fim: this.formatarData(fase.dataFim),
      tempo,
      hoje: tempo !== null && tempo > 0 && tempo < 100 ? tempo : null,
      atrasada: tempo !== null && (fase.percentual ?? 0) < tempo - MARGEM_RISCO_PONTOS,
    };
  }

  ajustarPercentual(fase: FaseProjeto) {
    const valor = Number(fase.percentual);
    fase.percentual = Number.isFinite(valor) ? Math.min(100, Math.max(0, Math.round(valor))) : 0;
  }

  erroFase = '';

  editarFase() {
    const fase = this.faseAberta;
    if (!fase) return;
    materializarSituacoes(this.projeto);
    this.rascunhoFase = { ...fase };
    this.erroFase = '';
    this.editandoFase = true;
  }

  cancelarEdicaoFase() {
    this.rascunhoFase = null;
    this.erroFase = '';
    this.editandoFase = false;
  }

  // Fases cadastradas antes da data de fim obrigatória recebem as datas planejadas, que o gestor pode ajustar.
  private preencherDatasPlanejadas() {
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    (this.projeto.fases ?? []).forEach((f, i) => {
      if (f.dataInicio && f.dataFim) return;
      const janela = janelaFase(this.projeto, i);
      if (!janela) return;
      f.dataInicio = f.dataInicio || iso(janela.ini);
      f.dataFim = f.dataFim || iso(new Date(janela.fim.getTime() - 86400000));
    });
  }

  salvarFase() {
    const fase = this.faseAberta;
    const rascunho = this.rascunhoFase;
    if (!fase || !rascunho) return;
    if (!rascunho.nome?.trim()) {
      this.erroFase = 'Informe o nome da fase.';
      return;
    }
    if (!rascunho.dataFim) {
      this.erroFase = 'Informe a data de fim da fase.';
      return;
    }
    if (rascunho.dataInicio && rascunho.dataFim < rascunho.dataInicio) {
      this.erroFase = 'A data de fim precisa ser posterior à data de início.';
      return;
    }
    this.ajustarPercentual(rascunho);
    Object.assign(fase, rascunho, { nome: rascunho.nome.trim() });
    this.persistir();
    this.cancelarEdicaoFase();
  }

  // Concluir muda o status da fase e libera a próxima.
  concluirFase(i: number) {
    materializarSituacoes(this.projeto);
    const fases = this.projeto.fases ?? [];
    fases[i].situacao = 'CONCLUIDA';
    fases[i].percentual = 100;
    if (fases[i + 1] && fases[i + 1].situacao !== 'CONCLUIDA') {
      fases[i + 1].situacao = 'EM_ANDAMENTO';
    }
    this.cancelarEdicaoFase();
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

  // Papéis do projeto, de quem responde por ele até quem executa.
  get papeis(): { papel: string; nome?: string }[] {
    return [
      { papel: 'Patrocinador', nome: this.projeto.patrocinador },
      { papel: 'Gerente', nome: this.projeto.gerenteResponsavel },
      { papel: 'Product Owner', nome: this.projeto.po?.nome },
      { papel: 'Scrum Master', nome: this.projeto.scrumMaster?.nome },
    ];
  }

  // Tom fixo por pessoa, para o mesmo nome ter sempre a mesma cor.
  corAvatar(nome: string): string {
    const tons = ['#5B8DEF', '#3FB6A8', '#C58AF9', '#E8A15C', '#E07A9A', '#7FB069'];
    let h = 0;
    for (const c of nome) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return tons[h % tons.length];
  }

  iniciais(nome: string): string {
    const partes = nome.trim().split(/\s+/).filter(Boolean);
    return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
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

  recarregar() {
    location.reload();
  }
}
