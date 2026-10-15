import { ChangeDetectionStrategy, Component, HostListener, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { forkJoin } from 'rxjs';
import { ProjetoResponse } from '../../projetos/models/projeto';
import { ProjetoService } from '../../projetos/services/projeto.service';
import {
  Estado,
  ICONE_ESTADO,
  MARGEM_RISCO_PONTOS,
  ORDEM_ESTADOS,
  ROTULO_ESTADO,
  estadoProjeto,
  progressoProjeto,
} from '../../projetos/utils/saude';
import { Meta, MetaRequest, MetaService } from '../services/meta.service';
import { avaliarMeta } from '../utils/meta';

interface LinhaMeta {
  meta: Meta;
  // Quanto do caminho entre o valor inicial e o alvo já foi percorrido (0 a 100); null sem medição.
  atingido: number | null;
  // Onde a meta deveria estar hoje, pelo tempo decorrido: em % do caminho e na unidade do indicador.
  esperado: number;
  valorEsperado: number;
  foraDoRitmo: boolean;
  estado: Estado;
  motivo: string;
}

interface LinhaProjeto {
  projeto: ProjetoResponse;
  estado: Estado;
  avanco: number;
}

interface Objetivo {
  titulo: string;
  semDefinicao: boolean;
  metas: LinhaMeta[];
  projetos: LinhaProjeto[];
  // Média do atingimento das metas; sem metas, média do avanço dos projetos.
  progresso: number;
  porMetas: boolean;
  estado: Estado;
}

const SEM_OBJETIVO = 'Sem objetivo estratégico definido';

@Component({
  // Dados chegam da API depois da renderização; sem Eager a tela não atualiza.
  changeDetection: ChangeDetectionStrategy.Eager,
  selector: 'app-objetivos',
  imports: [RouterLink, FormsModule, MatIconModule],
  templateUrl: './objetivos.html',
  styleUrl: './objetivos.scss',
})
export class Objetivos implements OnInit {
  projetos: ProjetoResponse[] = [];
  metas: Meta[] = [];
  carregando = true;
  erro = false;

  abertos = new Set<string>();

  readonly rotulo = ROTULO_ESTADO;
  readonly icone = ICONE_ESTADO;

  constructor(
    private projetoService: ProjetoService,
    private metaService: MetaService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {
    this.projetoService.seedSeNecessario();
    forkJoin({ projetos: this.projetoService.listar(0, 200), metas: this.metaService.listar() }).subscribe({
      next: ({ projetos, metas }) => {
        this.projetos = projetos.content;
        this.metas = metas;
        // Objetivos com algo fora do previsto já abrem.
        this.objetivos.filter((o) => o.estado === 'ATRASADO' || o.estado === 'RISCO').forEach((o) => this.abertos.add(o.titulo));
        // Vindo da busca global: abre o objetivo pedido.
        const abrir = this.route.snapshot.queryParamMap.get('abrir');
        if (abrir) this.abertos.add(abrir);
        this.carregando = false;
      },
      error: () => {
        this.carregando = false;
        this.erro = true;
      },
    });
  }

  // ---- Montagem ----

  get objetivos(): Objetivo[] {
    const titulos = new Set<string>();
    const projetosPor = new Map<string, LinhaProjeto[]>();
    this.projetos
      .filter((p) => p.status !== 'REJEITADO')
      .forEach((p) => {
        const titulo = (p.objetivoEstrategico ?? '').trim() || SEM_OBJETIVO;
        titulos.add(titulo);
        projetosPor.set(titulo, [...(projetosPor.get(titulo) ?? []), { projeto: p, estado: estadoProjeto(p), avanco: progressoProjeto(p) }]);
      });
    const metasPor = new Map<string, LinhaMeta[]>();
    this.metas.forEach((m) => {
      titulos.add(m.objetivo);
      metasPor.set(m.objetivo, [...(metasPor.get(m.objetivo) ?? []), this.linhaMeta(m)]);
    });

    const ordem = (e: Estado) => ORDEM_ESTADOS.indexOf(e);
    return [...titulos]
      .map((titulo) => {
        const metas = (metasPor.get(titulo) ?? []).sort((a, b) => ordem(a.estado) - ordem(b.estado));
        const projetos = (projetosPor.get(titulo) ?? []).sort((a, b) => ordem(a.estado) - ordem(b.estado));
        const medidas = metas.filter((m) => m.atingido !== null);
        const porMetas = medidas.length > 0;
        const progresso = porMetas
          ? Math.round(medidas.reduce((a, m) => a + m.atingido!, 0) / medidas.length)
          : projetos.length
            ? Math.round(projetos.reduce((a, p) => a + p.avanco, 0) / projetos.length)
            : 0;
        // O objetivo é medido pelas metas; os projetos só contam quando ainda não há meta.
        const estados = metas.length ? metas.map((m) => m.estado) : projetos.map((p) => p.estado);
        const estado = estados.length ? estados.reduce((a, b) => (ordem(b) < ordem(a) ? b : a)) : 'A_INICIAR';
        return { titulo, semDefinicao: titulo === SEM_OBJETIVO, metas, projetos, progresso, porMetas, estado };
      })
      .sort(
        (a, b) => Number(a.semDefinicao) - Number(b.semDefinicao) || ordem(a.estado) - ordem(b.estado) || a.titulo.localeCompare(b.titulo),
      );
  }

  // Situação da meta: o caminho percorrido comparado com o tempo já decorrido até o prazo.
  private linhaMeta(m: Meta): LinhaMeta {
    return { meta: m, ...avaliarMeta(m) };
  }

  // ---- Resumo ----

  get totalMetas(): number {
    return this.metas.length;
  }

  get metasForaDoPrevisto(): number {
    return this.objetivos.reduce((a, o) => a + o.metas.filter((m) => m.estado === 'ATRASADO' || m.estado === 'RISCO').length, 0);
  }

  get totalProjetos(): number {
    return this.objetivos.reduce((a, o) => a + o.projetos.length, 0);
  }

  // ---- Abrir e fechar ----

  alternar(titulo: string) {
    if (this.abertos.has(titulo)) this.abertos.delete(titulo);
    else this.abertos.add(titulo);
  }

  get todosAbertos(): boolean {
    const os = this.objetivos;
    return os.length > 0 && os.every((o) => this.abertos.has(o.titulo));
  }

  alternarTodos() {
    if (this.todosAbertos) this.abertos.clear();
    else this.objetivos.forEach((o) => this.abertos.add(o.titulo));
  }

  // ---- Edição de meta ----

  edicao: (MetaRequest & { id?: string }) | null = null;
  salvando = false;
  erroEdicao = '';

  get titulosObjetivos(): string[] {
    return this.objetivos.filter((o) => !o.semDefinicao).map((o) => o.titulo);
  }

  novaMeta(objetivo = '') {
    const ano = new Date().getFullYear();
    this.erroEdicao = '';
    this.edicao = {
      objetivo,
      indicador: '',
      unidade: '%',
      valorInicial: 0,
      valorAlvo: 100,
      valorAtual: null,
      dataInicio: `${ano}-01-01`,
      prazo: `${ano}-12-31`,
      responsavel: '',
    };
  }

  editar(m: Meta) {
    this.erroEdicao = '';
    const { id, objetivo, indicador, unidade, valorInicial, valorAlvo, valorAtual, dataInicio, prazo, responsavel } = m;
    this.edicao = { id, objetivo, indicador, unidade, valorInicial, valorAlvo, valorAtual, dataInicio, prazo, responsavel };
  }

  fecharEdicao() {
    this.edicao = null;
  }

  @HostListener('document:keydown.escape')
  aoEsc() {
    this.fecharEdicao();
  }

  salvar() {
    const e = this.edicao;
    if (!e) return;
    if (!e.objetivo.trim() || !e.indicador.trim() || !e.prazo || e.valorInicial == null || e.valorAlvo == null) {
      this.erroEdicao = 'Preencha objetivo, indicador, valores inicial e alvo e prazo.';
      return;
    }
    if (Number(e.valorInicial) === Number(e.valorAlvo)) {
      this.erroEdicao = 'O alvo precisa ser diferente do valor inicial.';
      return;
    }
    const { id, ...dados } = e;
    const corpo: MetaRequest = {
      ...dados,
      valorAtual: dados.valorAtual === null || (dados.valorAtual as unknown) === '' ? null : Number(dados.valorAtual),
      valorInicial: Number(dados.valorInicial),
      valorAlvo: Number(dados.valorAlvo),
      dataInicio: dados.dataInicio || null,
    };
    this.salvando = true;
    this.erroEdicao = '';
    (id ? this.metaService.atualizar(id, corpo) : this.metaService.criar(corpo)).subscribe({
      next: (salva) => {
        this.metas = id ? this.metas.map((m) => (m.id === id ? salva : m)) : [...this.metas, salva];
        this.abertos.add(salva.objetivo);
        this.salvando = false;
        this.edicao = null;
      },
      error: () => {
        this.salvando = false;
        this.erroEdicao = 'Não foi possível salvar a meta. Confira os dados e tente de novo.';
      },
    });
  }

  excluir() {
    const id = this.edicao?.id;
    if (!id || !confirm('Excluir esta meta?')) return;
    this.salvando = true;
    this.metaService.excluir(id).subscribe({
      next: () => {
        this.metas = this.metas.filter((m) => m.id !== id);
        this.salvando = false;
        this.edicao = null;
      },
      error: () => {
        this.salvando = false;
        this.erroEdicao = 'Não foi possível excluir a meta.';
      },
    });
  }

  // ---- Formatação ----

  private data(valor?: string | null): Date | null {
    if (!valor) return null;
    const [a, m, d] = valor.split('-').map(Number);
    return a && m && d ? new Date(a, m - 1, d) : null;
  }

  // Número sem unidade (ela vai uma vez, junto do nome do indicador), com até uma casa decimal.
  numero(v: number | null | undefined): string {
    if (v == null) return '—';
    return v.toLocaleString('pt-BR', { maximumFractionDigits: Math.abs(v) < 10 ? 1 : 0 });
  }

  foraDoRitmo(o: Objetivo): number {
    return o.metas.filter((m) => m.foraDoRitmo).length;
  }

  prazoCurto(valor?: string | null): string {
    const d = this.data(valor);
    return d ? d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '') : '—';
  }

  terminoCurto(p: ProjetoResponse): string {
    return this.prazoCurto(p.dataConclusaoPrevista);
  }

  iniciais(nome?: string | null): string {
    const partes = (nome ?? '').trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return '';
    return ((partes[0][0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
  }

  recarregar() {
    location.reload();
  }
}
