import { AfterViewChecked, ChangeDetectionStrategy, Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ProjetoResponse, StatusProjeto } from '../../projetos/models/projeto';
import { ProjetoService } from '../../projetos/services/projeto.service';
import { indiceFaseAtual, situacaoFase } from '../../projetos/utils/fase';
import { analisarProjeto, Estado, estadoProjeto, ICONE_ESTADO, progressoProjeto } from '../../projetos/utils/saude';

type Escala = 'MES' | 'TRIMESTRE';

interface Coluna {
  rotulo: string;
  ano: number;
  mes: number;
}

// Barra posicionada no período exibido, em % da largura da linha do tempo.
interface Barra {
  esquerda: number;
  largura: number;
  // Parte já feita, em % da própria barra.
  avanco: number;
}

interface LinhaFase {
  indice: number;
  nome: string;
  estado: Estado;
  inicio: Date;
  fim: Date;
  avanco: number | null;
  barra: Barra | null;
}

interface LinhaProjeto {
  projeto: ProjetoResponse;
  estado: Estado;
  inicio: Date;
  fim: Date;
  avanco: number;
  barra: Barra | null;
  fases: LinhaFase[];
}

interface Filtros {
  area: string;
  status: string;
  anoInicio: number;
  anoFim: number;
  escala: Escala;
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

@Component({
  // Dados chegam da API depois da renderização; sem Eager a tela não atualiza.
  changeDetection: ChangeDetectionStrategy.Eager,
  selector: 'app-cronograma',
  imports: [RouterLink, FormsModule, MatIconModule],
  templateUrl: './cronograma.html',
  styleUrl: './cronograma.scss',
})
export class Cronograma implements OnInit, AfterViewChecked {
  projetos: ProjetoResponse[] = [];
  carregando = true;
  erro = false;

  anosDisponiveis: number[] = [];
  areasDisponiveis: string[] = [];
  statusOpcoes: { valor: StatusProjeto; label: string }[] = [
    { valor: 'RASCUNHO', label: 'Rascunho' },
    { valor: 'AGUARDANDO_APROVACAO', label: 'Aguardando Aprovação' },
    { valor: 'APROVADO', label: 'Aprovado' },
    { valor: 'REJEITADO', label: 'Rejeitado' },
  ];

  // `rascunho` é o que o usuário edita; `filtros` é o que está aplicado à matriz.
  rascunho: Filtros = this.filtrosPadrao();
  filtros: Filtros = { ...this.rascunho };

  // Projetos com as fases abertas.
  abertos = new Set<string>();

  readonly icone = ICONE_ESTADO;

  @ViewChild('rolagem') private rolagem?: ElementRef<HTMLElement>;
  private centralizarHoje = true;

  constructor(private projetoService: ProjetoService) {}

  ngOnInit() {
    this.projetoService.seedSeNecessario();
    this.projetoService.listar(0, 200).subscribe({
      next: (res) => {
        this.projetos = res.content;
        this.prepararOpcoes();
        this.carregando = false;
      },
      error: () => {
        this.carregando = false;
        this.erro = true;
      },
    });
  }

  // Ao abrir a tela ou mudar o período, a rolagem horizontal põe "hoje" à vista.
  ngAfterViewChecked() {
    const el = this.rolagem?.nativeElement;
    if (!this.centralizarHoje || !el || this.posicaoHoje === null) return;
    this.centralizarHoje = false;
    const grade = el.querySelector<HTMLElement>('.tl-grade');
    if (!grade) return;
    const x = grade.offsetLeft + (grade.offsetWidth * this.posicaoHoje) / 100;
    el.scrollLeft = Math.max(0, x - el.clientWidth / 2);
  }

  private filtrosPadrao(): Filtros {
    const ano = new Date().getFullYear();
    return { area: '', status: '', anoInicio: ano, anoFim: ano + 1, escala: 'TRIMESTRE' };
  }

  private prepararOpcoes() {
    const anos = new Set<number>([new Date().getFullYear()]);
    this.projetos.forEach((p) => {
      [p.dataInicioPrevista, p.dataConclusaoPrevista].forEach((d) => {
        const data = this.parseData(d);
        if (data) anos.add(data.getFullYear());
      });
    });
    const min = Math.min(...anos);
    const max = Math.max(...anos);
    this.anosDisponiveis = Array.from({ length: max - min + 2 }, (_, i) => min + i);
    this.areasDisponiveis = [...new Set(this.projetos.map((p) => p.areaSolicitante || 'Sem área'))].sort();
  }

  filtrar() {
    if (this.rascunho.anoFim < this.rascunho.anoInicio) {
      this.rascunho.anoFim = this.rascunho.anoInicio;
    }
    this.filtros = { ...this.rascunho };
    this.centralizarHoje = true;
  }

  limpar() {
    this.rascunho = this.filtrosPadrao();
    this.filtros = { ...this.rascunho };
    this.centralizarHoje = true;
  }

  alternarEscala(escala: Escala) {
    this.rascunho.escala = escala;
    this.filtros = { ...this.filtros, escala };
    this.centralizarHoje = true;
  }

  // ---- Abrir e fechar projetos ----

  alternar(id: string) {
    if (this.abertos.has(id)) this.abertos.delete(id);
    else this.abertos.add(id);
  }

  get todosAbertos(): boolean {
    const comFases = this.linhas.filter((l) => l.fases.length > 0);
    return comFases.length > 0 && comFases.every((l) => this.abertos.has(l.projeto.id));
  }

  alternarTodos() {
    if (this.todosAbertos) this.abertos.clear();
    else this.linhas.forEach((l) => l.fases.length > 0 && this.abertos.add(l.projeto.id));
  }

  // ---- Período e colunas ----

  get totalMeses(): number {
    return (this.filtros.anoFim - this.filtros.anoInicio + 1) * 12;
  }

  get colunas(): Coluna[] {
    const tri = this.filtros.escala === 'TRIMESTRE';
    const passo = tri ? 3 : 1;
    return Array.from({ length: this.totalMeses / passo }, (_, i) => {
      const mes = i * passo;
      const ano = this.filtros.anoInicio + Math.floor(mes / 12);
      const m = mes % 12;
      return { rotulo: tri ? `T${Math.floor(m / 3) + 1}` : MESES[m], ano, mes };
    });
  }

  get anosColuna(): { ano: number; colunas: number }[] {
    const grupos: { ano: number; colunas: number }[] = [];
    this.colunas.forEach((c) => {
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.ano === c.ano) ultimo.colunas++;
      else grupos.push({ ano: c.ano, colunas: 1 });
    });
    return grupos;
  }

  get larguraLinhaTempo(): number {
    return this.colunas.length * (this.filtros.escala === 'TRIMESTRE' ? 96 : 48);
  }

  // Posição em "meses desde o início do período", com fração do mês pelo dia.
  private posicao(data: Date): number {
    const dias = new Date(data.getFullYear(), data.getMonth() + 1, 0).getDate();
    return (data.getFullYear() - this.filtros.anoInicio) * 12 + data.getMonth() + (data.getDate() - 1) / dias;
  }

  get posicaoHoje(): number | null {
    const pos = this.posicao(new Date());
    return pos >= 0 && pos <= this.totalMeses ? (pos / this.totalMeses) * 100 : null;
  }

  private parseData(valor?: string): Date | null {
    if (!valor) return null;
    const [a, m, d] = valor.split('-').map(Number);
    if (!a || !m || !d) return null;
    return new Date(a, m - 1, d);
  }

  // Data a partir da posição absoluta em meses (a mesma escala de utils/saude).
  private dataAbsoluta(pos: number): Date {
    const ano = Math.floor(pos / 12);
    const mes = Math.floor(pos) % 12;
    const dias = new Date(ano, mes + 1, 0).getDate();
    return new Date(ano, mes, 1 + Math.floor((pos - Math.floor(pos)) * dias));
  }

  // Converte uma janela absoluta (meses) para a barra no período exibido; null se fica fora.
  private barra(ini: number, fim: number, avanco: number): Barra | null {
    const base = this.filtros.anoInicio * 12;
    const a = Math.max(0, ini - base);
    const b = Math.min(this.totalMeses, fim - base);
    if (b <= a) return null;
    return { esquerda: (a / this.totalMeses) * 100, largura: ((b - a) / this.totalMeses) * 100, avanco };
  }

  // ---- Linhas ----

  private projetosFiltrados(): ProjetoResponse[] {
    return this.projetos.filter(
      (p) =>
        (!this.filtros.area || (p.areaSolicitante || 'Sem área') === this.filtros.area) &&
        (!this.filtros.status || p.status === this.filtros.status),
    );
  }

  private montarLinha(p: ProjetoResponse): LinhaProjeto | null {
    const inicio = this.parseData(p.dataInicioPrevista);
    const fim = this.parseData(p.dataConclusaoPrevista);
    // A regra de saúde é compartilhada (utils/saude); aqui só se desenha.
    const analise = analisarProjeto(p);
    if (!inicio || !fim || !analise) return null;

    const avanco = progressoProjeto(p);
    const fases: LinhaFase[] = (p.fases ?? []).map((f, i) => {
      const j = analise.janelas[i];
      const situacao = situacaoFase(p, i);
      const avancoFase = situacao === 'CONCLUIDA' ? 100 : situacao === 'EM_ANDAMENTO' ? Math.min(f.percentual ?? 0, 100) : 0;
      return {
        indice: i,
        nome: f.nome,
        estado: analise.estados[i],
        inicio: this.dataAbsoluta(j.ini),
        fim: this.dataAbsoluta(j.fim - 1 / 30),
        avanco: situacao === 'PENDENTE' ? null : avancoFase,
        barra: this.barra(j.ini, j.fim, avancoFase),
      };
    });

    return {
      projeto: p,
      estado: analise.estado,
      inicio,
      fim,
      avanco,
      barra: this.barra(analise.posInicio, analise.posFim, avanco),
      fases,
    };
  }

  // Pior situação primeiro; empate pelo término mais próximo.
  get linhas(): LinhaProjeto[] {
    return this.projetosFiltrados()
      .map((p) => this.montarLinha(p))
      .filter((l): l is LinhaProjeto => l !== null)
      .sort((a, b) => this.prioridade(a.estado) - this.prioridade(b.estado) || a.fim.getTime() - b.fim.getTime());
  }

  get semCronograma(): ProjetoResponse[] {
    return this.projetosFiltrados().filter((p) => !this.montarLinha(p));
  }

  private prioridade(estado: Estado): number {
    return this.estadosInfo.findIndex((e) => e.estado === estado);
  }

  // ---- Painel de detalhe da fase ----

  selecionado: { linha: LinhaProjeto; fase: LinhaFase } | null = null;

  abrir(linha: LinhaProjeto, fase: LinhaFase) {
    this.selecionado = { linha, fase };
  }

  fechar() {
    this.selecionado = null;
  }

  @HostListener('document:keydown.escape')
  aoEsc() {
    this.fechar();
  }

  // Por que a fase está nesse estado, em uma frase.
  motivo(linha: LinhaProjeto, fase: LinhaFase): string {
    const ini = this.fmt(fase.inicio);
    const fim = this.fmt(fase.fim);
    const hoje = new Date();
    const atual = indiceFaseAtual(linha.projeto);
    switch (fase.estado) {
      case 'CONCLUIDO':
        return 'Fase concluída.';
      case 'A_INICIAR':
        return `Prevista para começar em ${ini}.`;
      case 'ATRASADO':
        if (fase.indice !== atual) return `Deveria ter começado em ${ini}, mas a fase anterior ainda não foi concluída.`;
        if (hoje > fase.fim) return `O prazo venceu em ${fim} e a fase não foi concluída.`;
        return 'O projeto está marcado como atrasado no prazo.';
      case 'RISCO': {
        const total = fase.fim.getTime() - fase.inicio.getTime();
        const esperado = total > 0 ? Math.round(((hoje.getTime() - fase.inicio.getTime()) / total) * 100) : 0;
        return fase.avanco != null
          ? `Andamento em ${fase.avanco}%, e o esperado para hoje seria cerca de ${esperado}%.`
          : 'O projeto está em atenção quanto ao prazo.';
      }
      default:
        return `Dentro do prazo, com término previsto em ${fim}.`;
    }
  }

  // ---- Estados ----

  readonly estadosInfo: { estado: Estado; rotulo: string }[] = [
    { estado: 'ATRASADO', rotulo: 'Atrasados' },
    { estado: 'RISCO', rotulo: 'Em risco' },
    { estado: 'ANDAMENTO', rotulo: 'Em andamento' },
    { estado: 'A_INICIAR', rotulo: 'A iniciar' },
    { estado: 'CONCLUIDO', rotulo: 'Concluídos' },
  ];

  rotuloEstado(estado: Estado): string {
    const mapa: Record<Estado, string> = {
      ATRASADO: 'Atrasado',
      RISCO: 'Em risco',
      ANDAMENTO: 'Em andamento',
      A_INICIAR: 'A iniciar',
      CONCLUIDO: 'Concluído',
    };
    return mapa[estado];
  }

  get resumoEstados(): { estado: Estado; rotulo: string; qtd: number }[] {
    const linhas = this.linhas;
    return this.estadosInfo
      .map((e) => ({ ...e, qtd: linhas.filter((l) => l.estado === e.estado).length }))
      .filter((e) => e.qtd > 0);
  }

  // ---- Rótulos ----

  fmt(d: Date): string {
    return d.toLocaleDateString('pt-BR');
  }

  fmtCurto(d: Date): string {
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }

  statusLabel(status?: StatusProjeto): string {
    return this.statusOpcoes.find((s) => s.valor === status)?.label ?? 'Rascunho';
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

  // ---- Impressão e exportação ----

  get emitidoEm(): string {
    return new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  // O que está aplicado à matriz, para sair no cabeçalho do documento impresso.
  get filtrosAplicados(): { rotulo: string; valor: string }[] {
    const f = this.filtros;
    return [
      { rotulo: 'Área', valor: f.area || 'Todas' },
      { rotulo: 'Status', valor: f.status ? this.statusLabel(f.status as StatusProjeto) : 'Todos' },
      { rotulo: 'Período', valor: f.anoInicio === f.anoFim ? `${f.anoInicio}` : `${f.anoInicio} a ${f.anoFim}` },
      { rotulo: 'Escala', valor: f.escala === 'TRIMESTRE' ? 'Trimestre' : 'Mês' },
    ];
  }

  private get sufixoArquivo(): string {
    const f = this.filtros;
    const periodo = f.anoInicio === f.anoFim ? `${f.anoInicio}` : `${f.anoInicio}-${f.anoFim}`;
    return `${periodo}_${new Date().toISOString().slice(0, 10)}`;
  }

  // O navegador usa o título da página como nome do PDF.
  imprimir() {
    const titulo = document.title;
    document.title = `SIGOV-TIC_Cronograma-Geral_${this.sufixoArquivo}`;
    window.addEventListener('afterprint', () => (document.title = titulo), { once: true });
    window.print();
  }

  // Uma linha por projeto filtrado, com a mesma leitura de saúde mostrada na matriz.
  exportar() {
    const data = (v?: string) => this.parseData(v)?.toLocaleDateString('pt-BR') ?? '';
    const numero = (v?: number) => (v != null ? v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');
    const cabecalho = [
      'Sigla', 'Projeto', 'Área solicitante', 'Área executora', 'Status do cadastro', 'Situação do prazo',
      'Fase atual', 'Avanço (%)', 'Início previsto', 'Conclusão prevista',
      'Orçamento estimado (R$)', 'Custo realizado (R$)', 'Fases',
    ];
    const linhas = this.projetosFiltrados().map((p) => {
      const fases = p.fases ?? [];
      const atual = indiceFaseAtual(p);
      return [
        p.sigla,
        p.nome,
        p.areaSolicitante || '',
        p.areaExecutora || '',
        this.statusLabel(p.status),
        analisarProjeto(p) ? this.rotuloEstado(estadoProjeto(p)) : 'Sem cronograma',
        atual >= 0 ? fases[atual].nome : fases.length ? 'Todas concluídas' : '',
        fases.length ? String(progressoProjeto(p)) : '',
        data(p.dataInicioPrevista),
        data(p.dataConclusaoPrevista),
        numero(p.orcamentoEstimado),
        numero(p.custoRealizado),
        fases.map((f) => `${f.nome} (${f.duracaoMeses}m)`).join(' > '),
      ];
    });
    const csv = [cabecalho, ...linhas]
      .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SIGOV-TIC_Cronograma-Geral_${this.sufixoArquivo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  recarregar() {
    location.reload();
  }
}
