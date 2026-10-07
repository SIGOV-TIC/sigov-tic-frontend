import { Component, HostListener, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ProjetoResponse, StatusProjeto } from '../../projetos/models/projeto';
import { ProjetoService } from '../../projetos/services/projeto.service';
import { indiceFaseAtual, situacaoFase } from '../../projetos/utils/fase';

type Escala = 'MES' | 'TRIMESTRE';

interface Coluna {
  rotulo: string;
  ano: number;
  trimestre?: number;
  mes: number;
}

// Detalhe que o painel mostra ao clicar num bloco.
interface Detalhe {
  fase: string;
  estado: Estado;
  periodo: string;
  percentual: number | null;
  motivo: string;
}

type Estado = 'CONCLUIDO' | 'ANDAMENTO' | 'RISCO' | 'ATRASADO' | 'A_INICIAR';

// Um bloco da grade: o estado do projeto naquele período (null = fora da janela do projeto).
interface Celula {
  estado: Estado | null;
  atual: boolean;
  marco: Estado | null;
  titulo: string;
  detalhe: Detalhe | null;
}

interface LinhaCronograma {
  projeto: ProjetoResponse;
  estado: Estado;
  esquerda: number;
  largura: number;
  celulas: Celula[];
  titulo: string;
}

interface GrupoArea {
  area: string;
  linhas: LinhaCronograma[];
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
  selector: 'app-cronograma',
  imports: [RouterLink, FormsModule, MatIconModule],
  templateUrl: './cronograma.html',
  styleUrl: './cronograma.scss',
})
export class Cronograma implements OnInit {
  projetos: ProjetoResponse[] = [];
  carregando = true;

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

  constructor(private projetoService: ProjetoService) {}

  ngOnInit() {
    this.projetoService.seedSeNecessario();
    this.projetoService.listar(0, 200).subscribe({
      next: (res) => {
        this.projetos = res.content;
        this.prepararOpcoes();
        this.carregando = false;
      },
      error: () => (this.carregando = false),
    });
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
  }

  limpar() {
    this.rascunho = this.filtrosPadrao();
    this.filtros = { ...this.rascunho };
  }

  alternarEscala(escala: Escala) {
    this.rascunho.escala = escala;
    this.filtros = { ...this.filtros, escala };
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
      return tri
        ? { rotulo: `T${Math.floor(m / 3) + 1}`, ano, trimestre: Math.floor(m / 3) + 1, mes }
        : { rotulo: MESES[m], ano, mes };
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

  get larguraMinima(): number {
    return this.colunas.length * (this.filtros.escala === 'TRIMESTRE' ? 84 : 44);
  }

  // ---- Painel de detalhe ----

  selecionado: { linha: LinhaCronograma; celula: Celula } | null = null;

  abrir(linha: LinhaCronograma, celula: Celula) {
    this.selecionado = { linha, celula };
  }

  fechar() {
    this.selecionado = null;
  }

  @HostListener('document:keydown.escape')
  aoEsc() {
    this.fechar();
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

  // ---- Linhas ----

  private projetosFiltrados(): ProjetoResponse[] {
    return this.projetos.filter(
      (p) =>
        (!this.filtros.area || (p.areaSolicitante || 'Sem área') === this.filtros.area) &&
        (!this.filtros.status || p.status === this.filtros.status),
    );
  }

  private montarLinha(p: ProjetoResponse): LinhaCronograma | null {
    const inicio = this.parseData(p.dataInicioPrevista);
    const fim = this.parseData(p.dataConclusaoPrevista);
    if (!inicio || !fim || fim < inicio) return null;

    const posInicio = this.posicao(inicio);
    const posFim = this.posicao(fim) + 1 / 30;
    if (posFim < 0 || posInicio > this.totalMeses) return { ...this.linhaVazia(p) };

    const posHoje = this.posicao(new Date());
    const atual = indiceFaseAtual(p);
    const fases = p.fases ?? [];

    // Janela de cada fase: datas da própria fase, ou duração acumulada a partir do início do projeto.
    const totalDuracao = fases.reduce((acc, f) => acc + Math.max(f.duracaoMeses || 1, 1), 0);
    const escala = totalDuracao > posFim - posInicio ? (posFim - posInicio) / totalDuracao : 1;
    let acumulado = 0;
    const janelas = fases.map((f) => {
      const dur = Math.max(f.duracaoMeses || 1, 1) * escala;
      const faseIni = this.parseData(f.dataInicio);
      const faseFim = this.parseData(f.dataFim);
      const janela =
        faseIni && faseFim && faseFim > faseIni
          ? { ini: this.posicao(faseIni), fim: this.posicao(faseFim) + 1 / 30 }
          : { ini: posInicio + acumulado, fim: posInicio + acumulado + dur };
      acumulado += dur;
      return janela;
    });

    const estados = fases.map((_, i) => this.estadoFase(p, i, atual, janelas[i], posHoje));
    const estado = this.estadoProjeto(p, estados, posHoje, posInicio, posFim);

    const inicioVisivel = Math.max(0, posInicio);
    const fimVisivel = Math.min(this.totalMeses, posFim);
    return {
      projeto: p,
      estado,
      esquerda: (inicioVisivel / this.totalMeses) * 100,
      largura: ((fimVisivel - inicioVisivel) / this.totalMeses) * 100,
      celulas: this.montarCelulas(p, fases.map((f) => f.nome), janelas, estados, atual, estado, posInicio, posFim, posHoje),
      titulo: this.titulo(p, inicio, fim, estado),
    };
  }

  // Uma célula por coluna: o estado da fase que mais ocupa aquele período.
  // O que ainda não chegou é sempre "previsto", para o olho ver onde o projeto está agora.
  private montarCelulas(
    p: ProjetoResponse,
    nomes: string[],
    janelas: { ini: number; fim: number }[],
    estados: Estado[],
    atual: number,
    estadoProjeto: Estado,
    posInicio: number,
    posFim: number,
    posHoje: number,
  ): Celula[] {
    const passo = this.filtros.escala === 'TRIMESTRE' ? 3 : 1;
    const fases = nomes.length > 0 ? nomes : [''];
    const jan = nomes.length > 0 ? janelas : [{ ini: posInicio, fim: posFim }];
    const est = nomes.length > 0 ? estados : [estadoProjeto];

    return this.colunas.map((_, c) => {
      const a = c * passo;
      const b = a + passo;
      let melhor = -1;
      let maior = 0;
      jan.forEach((j, i) => {
        const sobra = Math.min(b, j.fim) - Math.max(a, j.ini);
        if (sobra > maior) {
          maior = sobra;
          melhor = i;
        }
      });
      const marcoIdx = jan.findIndex((j) => j.fim > a && j.fim <= b + 0.001);
      const marco = marcoIdx >= 0 ? (est[marcoIdx] === 'CONCLUIDO' ? 'CONCLUIDO' : 'A_INICIAR') : null;
      if (melhor < 0) return { estado: null, atual: false, marco, titulo: '', detalhe: null };

      let estadoCelula = est[melhor];
      const futura = a > posHoje;
      if (futura && estadoCelula !== 'CONCLUIDO') estadoCelula = 'A_INICIAR';
      const nome = fases[melhor];
      const fase = nomes.length > 0 ? p.fases![melhor] : null;
      const percentual = fase?.percentual ?? null;
      return {
        estado: estadoCelula,
        atual: melhor === atual && posHoje >= a && posHoje < b,
        marco,
        titulo: `${nome ? nome + ' · ' : ''}${this.rotuloEstado(estadoCelula)}`,
        detalhe: {
          fase: nome || 'Projeto',
          estado: estadoCelula,
          periodo: `${this.fmt(this.dataDePos(jan[melhor].ini))} a ${this.fmt(this.dataDePos(jan[melhor].fim - 1 / 30))}`,
          percentual,
          motivo: this.motivo(estadoCelula, est[melhor], melhor !== atual, percentual, jan[melhor], posHoje, p),
        },
      };
    });
  }

  private fmt(d: Date): string {
    return d.toLocaleDateString('pt-BR');
  }

  private dataDePos(pos: number): Date {
    const m = pos;
    const ano = this.filtros.anoInicio + Math.floor(m / 12);
    const mes = ((Math.floor(m) % 12) + 12) % 12;
    const dias = new Date(ano, mes + 1, 0).getDate();
    return new Date(ano, mes, 1 + Math.round((m - Math.floor(m)) * dias));
  }

  // Por que o bloco está nesse estado, em uma frase.
  private motivo(
    estado: Estado,
    estadoFase: Estado,
    foraDaAtual: boolean,
    percentual: number | null,
    janela: { ini: number; fim: number },
    posHoje: number,
    p: ProjetoResponse,
  ): string {
    const fim = this.fmt(this.dataDePos(janela.fim - 1 / 30));
    const ini = this.fmt(this.dataDePos(janela.ini));
    if (estado === 'CONCLUIDO') return 'Fase concluída.';
    if (estado === 'A_INICIAR') {
      return estadoFase === 'A_INICIAR' ? `Previsto para começar em ${ini}.` : `Previsto: a fase segue até ${fim}.`;
    }
    if (estado === 'ATRASADO') {
      if (foraDaAtual) return `Deveria ter começado em ${ini}, mas a fase anterior ainda não foi concluída.`;
      if (posHoje > janela.fim) return `O prazo venceu em ${fim} e a fase não foi concluída.`;
      return 'O projeto está marcado como atrasado no prazo.';
    }
    if (estado === 'RISCO') {
      if (percentual != null) {
        const esperado = Math.round(((posHoje - janela.ini) / (janela.fim - janela.ini)) * 100);
        return `Andamento em ${percentual}%, e o esperado para hoje seria cerca de ${esperado}%.`;
      }
      return 'O projeto está em atenção quanto ao prazo.';
    }
    return `Dentro do prazo, com término previsto em ${fim}.`;
  }

  // ---- Estados (o que o diretor precisa ver de relance) ----

  private estadoFase(
    p: ProjetoResponse,
    i: number,
    atual: number,
    janela: { ini: number; fim: number },
    posHoje: number,
  ): Estado {
    if (situacaoFase(p, i) === 'CONCLUIDA') return 'CONCLUIDO';
    if (posHoje < janela.ini) return 'A_INICIAR';
    // Já deveria ter começado e a fase anterior ainda não fechou.
    if (i !== atual) return 'ATRASADO';
    if (posHoje > janela.fim) return 'ATRASADO';

    const fase = p.fases![i];
    if (fase.percentual != null) {
      const tempo = ((posHoje - janela.ini) / (janela.fim - janela.ini)) * 100;
      if (fase.percentual < tempo - 15) return 'RISCO';
      return 'ANDAMENTO';
    }
    if (p.prazoQuadrante === 'ATRASADO') return 'ATRASADO';
    if (p.prazoQuadrante === 'ATENCAO') return 'RISCO';
    return 'ANDAMENTO';
  }

  private estadoProjeto(p: ProjetoResponse, estados: Estado[], posHoje: number, posInicio: number, posFim: number): Estado {
    if (p.prazoQuadrante === 'CONCLUIDO' || (estados.length > 0 && estados.every((e) => e === 'CONCLUIDO'))) {
      return 'CONCLUIDO';
    }
    if (estados.some((e) => e === 'ATRASADO')) return 'ATRASADO';
    if (estados.some((e) => e === 'RISCO')) return 'RISCO';
    if (posHoje < posInicio) return 'A_INICIAR';
    if (estados.length === 0) {
      if (posHoje > posFim || p.prazoQuadrante === 'ATRASADO') return 'ATRASADO';
      if (p.prazoQuadrante === 'ATENCAO') return 'RISCO';
    }
    return 'ANDAMENTO';
  }

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
    const linhas = this.grupos.flatMap((g) => g.linhas);
    return this.estadosInfo.map((e) => ({ ...e, qtd: linhas.filter((l) => l.estado === e.estado).length }));
  }

  // Projeto com datas, mas fora do período exibido.
  private linhaVazia(p: ProjetoResponse): LinhaCronograma {
    return { projeto: p, estado: 'A_INICIAR', esquerda: 0, largura: 0, celulas: [], titulo: '' };
  }

  private titulo(p: ProjetoResponse, inicio: Date, fim: Date, estado: Estado): string {
    const fmt = (d: Date) => d.toLocaleDateString('pt-BR');
    const partes = [`${p.nome} (${p.sigla})`, this.rotuloEstado(estado), `${fmt(inicio)} a ${fmt(fim)}`];
    if (p.orcamentoEstimado) partes.push('R$ ' + p.orcamentoEstimado.toLocaleString('pt-BR'));
    return partes.join(' · ');
  }

  get grupos(): GrupoArea[] {
    const mapa = new Map<string, LinhaCronograma[]>();
    this.projetosFiltrados().forEach((p) => {
      const linha = this.montarLinha(p);
      if (!linha) return;
      const area = p.areaSolicitante || 'Sem área';
      mapa.set(area, [...(mapa.get(area) ?? []), linha]);
    });
    return [...mapa.entries()]
      .map(([area, linhas]) => ({
        area,
        linhas: linhas.sort(
          (a, b) => this.prioridade(a.estado) - this.prioridade(b.estado) || a.projeto.nome.localeCompare(b.projeto.nome),
        ),
      }))
      // Áreas com o pior estado primeiro; empate por ordem alfabética.
      .sort((a, b) => this.piorPrioridade(a) - this.piorPrioridade(b) || a.area.localeCompare(b.area));
  }

  private piorPrioridade(grupo: GrupoArea): number {
    return Math.min(...grupo.linhas.map((l) => this.prioridade(l.estado)));
  }

  private prioridade(estado: Estado): number {
    return this.estadosInfo.findIndex((e) => e.estado === estado);
  }

  get semCronograma(): ProjetoResponse[] {
    return this.projetosFiltrados().filter((p) => !this.montarLinha(p));
  }

  get totalNaMatriz(): number {
    return this.grupos.reduce((acc, g) => acc + g.linhas.length, 0);
  }

  foraDoPeriodo(l: LinhaCronograma): boolean {
    return l.largura === 0;
  }

  // ---- Rótulos ----

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

  // ---- Ações ----

  imprimir() {
    window.print();
  }

  exportar() {
    const fmt = (v?: string) => this.parseData(v)?.toLocaleDateString('pt-BR') ?? '';
    const cabecalho = ['Projeto', 'Sigla', 'Área', 'Status', 'Início previsto', 'Conclusão prevista', 'Orçamento estimado', 'Fases'];
    const linhas = this.projetosFiltrados().map((p) => [
      p.nome,
      p.sigla,
      p.areaSolicitante || '',
      this.statusLabel(p.status),
      fmt(p.dataInicioPrevista),
      fmt(p.dataConclusaoPrevista),
      p.orcamentoEstimado != null ? String(p.orcamentoEstimado) : '',
      (p.fases ?? []).map((f) => `${f.nome} (${f.duracaoMeses}m)`).join(' > '),
    ]);
    const csv = [cabecalho, ...linhas]
      .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cronograma-${this.filtros.anoInicio}-${this.filtros.anoFim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
