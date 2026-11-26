import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Atividade, Atualizacao, ProjetoResponse, SituacaoFase } from '../../projetos/models/projeto';
import { ProjetoService } from '../../projetos/services/projeto.service';
import { analisarProjeto, Estado, ICONE_ESTADO, progressoProjeto, ROTULO_ESTADO } from '../../projetos/utils/saude';
import { basePlausivel, calcularDesvio, fracaoDecorrida, TOLERANCIA_DESVIO } from '../../projetos/utils/desvio';
import { situacaoFase } from '../../projetos/utils/fase';
import { EstadoTela } from '../../../shared/estado/estado';
import { mensagemDeErro } from '../../../shared/estado/erro-api';
import { AuthService } from '../../../core/auth/auth.service';
import { RetratoService } from '../services/retrato.service';
import { Metrica, Retrato, meta, valor } from '../models/retrato';
import { GraficoTendencia, SerieGrafico } from '../../../shared/grafico/grafico-tendencia';
import { Gasto } from '../../orcamento/models/gasto';
import { GastoService } from '../../orcamento/services/gasto.service';
import { acumuladoAte } from '../../orcamento/utils/linha-do-tempo';

// Mês do relatório, do dia 1 ao último dia.
interface Periodo {
  chave: string; // 2026-10
  ini: string;
  fim: string;
  rotulo: string;
}

interface AtividadeNaFase {
  atividade: Atividade;
  fase: string;
}

// Dias depois do fim do mês que entram em "próximas entregas".
const HORIZONTE_DIAS = 30;
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESES_EXTENSO = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function periodoDe(ano: number, mes: number): Periodo {
  const ini = new Date(ano, mes, 1);
  return {
    chave: iso(ini).slice(0, 7),
    ini: iso(ini),
    fim: iso(new Date(ano, mes + 1, 0)),
    rotulo: `${MESES_EXTENSO[mes]} de ${ano}`,
  };
}

// Mês (aaaa-mm) a que um retrato pertence; os da época quinzenal caem no mês em que começaram.
function mesDo(retrato: Retrato): string {
  return retrato.periodoInicio.slice(0, 7);
}

@Component({
  // Dados chegam da API depois da renderização; sem Eager a tela não atualiza.
  changeDetection: ChangeDetectionStrategy.Eager,
  selector: 'app-status-report',
  imports: [RouterLink, FormsModule, MatIconModule, NgTemplateOutlet, EstadoTela, GraficoTendencia],
  templateUrl: './status-report.html',
  styleUrl: './status-report.scss',
})
export class StatusReport implements OnInit {
  projetos: ProjetoResponse[] = [];
  projeto: ProjetoResponse | null = null;
  carregando = true;
  erro = '';

  // O mês atual e os onze anteriores.
  readonly periodos: Periodo[] = (() => {
    const hoje = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      return periodoDe(d.getFullYear(), d.getMonth());
    });
  })();
  periodo = this.periodos[0];
  readonly emissao = iso(new Date());

  // Retratos já emitidos do projeto; o do mês escolhido é o documento que vale.
  retratos: Retrato[] = [];
  gastos: Gasto[] = [];
  emitindo = false;
  erroEmissao = '';

  constructor(
    private projetoService: ProjetoService,
    private retratoService: RetratoService,
    private gastoService: GastoService,
    private auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit() {
    const params = this.route.snapshot.queryParamMap;
    this.periodo = this.periodos.find((p) => p.chave === params.get('mes')) ?? this.periodos[0];
    this.projetoService.seedSeNecessario();
    this.projetoService.listar(0, 100, 'todos').subscribe({
      next: (pagina) => {
        // Ativos primeiro; aposentados no fim, para consultar o que já foi emitido.
        this.projetos = [...pagina.content].sort(
          (a, b) => Number(!!a.aposentadoria) - Number(!!b.aposentadoria) || a.sigla.localeCompare(b.sigla),
        );
        const id = params.get('projeto');
        this.selecionar(this.projetos.find((p) => p.id === id)?.id ?? this.projetos[0]?.id);
      },
      error: (e) => {
        this.carregando = false;
        this.erro = mensagemDeErro(e, 'o relatório');
      },
    });
  }

  tentarNovamente() {
    this.erro = '';
    this.carregando = true;
    this.ngOnInit();
  }

  // A lista não traz tudo o que o relatório usa de forma garantida; o projeto vem completo pelo id.
  selecionar(id?: string) {
    if (!id) {
      this.carregando = false;
      return;
    }
    this.carregando = true;
    this.projetoService.obter(id).subscribe({
      next: (p) => {
        this.projeto = p;
        this.carregando = false;
        this.gravarNaUrl();
        this.carregarRetratos(id);
      },
      error: (e) => {
        this.carregando = false;
        this.erro = mensagemDeErro(e, 'o relatório');
      },
    });
  }

  mudarPeriodo() {
    this.gravarNaUrl();
  }

  private gravarNaUrl() {
    this.router.navigate([], {
      queryParams: { projeto: this.projeto?.id, mes: this.periodo.chave },
      replaceUrl: true,
    });
  }

  imprimir() {
    // O cabeçalho corrido vive na margem da página: é a única forma de repeti-lo
    // em todas as folhas. O texto é dinâmico, então entra como estilo na hora.
    const estilo = document.createElement('style');
    estilo.textContent = this.estiloDeImpressao();
    document.head.appendChild(estilo);
    window.print();
    estilo.remove();
  }

  estiloDeImpressao(): string {
    const esquerda = `${this.projeto?.sigla ?? ''} · ${this.projeto?.nome ?? ''}`;
    const direita = `${this.emitido ? 'Status Report' : 'Prévia'} · ${this.periodo.rotulo}`;
    const fonte = "font: 8pt 'Inter', sans-serif; color: #4F5D73;";
    return `@page {
      @top-left { content: ${JSON.stringify(esquerda)}; ${fonte} }
      @top-right { content: ${JSON.stringify(direita)}; ${fonte} }
    }`;
  }

  private carregarRetratos(projetoId: string) {
    this.retratos = [];
    this.retratoService.porProjeto(projetoId).subscribe({
      next: (lista) => (this.retratos = lista),
      // Sem retratos a tela segue como prévia; não há o que avisar.
      error: () => (this.retratos = []),
    });
    this.gastos = [];
    this.gastoService.doProjeto(projetoId).subscribe({
      next: (lista) => (this.gastos = lista),
      error: () => (this.gastos = []),
    });
  }

  // O documento emitido do mês escolhido (o último, se houver mais de um); null enquanto ele é só prévia.
  get retrato(): Retrato | null {
    return this.vigentes.get(this.periodo.chave) ?? null;
  }

  // O retrato que vale em cada mês: o último emitido dentro dele.
  private get vigentes(): Map<string, Retrato> {
    const porMes = new Map<string, Retrato>();
    for (const r of [...this.retratos].sort((a, b) => a.emitidoEm.localeCompare(b.emitidoEm))) {
      porMes.set(mesDo(r), r);
    }
    return porMes;
  }

  get emitido(): boolean {
    return !!this.retrato;
  }

  // Meses que já têm documento emitido, para marcar na lista.
  foiEmitido(p: Periodo): boolean {
    return this.retratos.some((r) => mesDo(r) === p.chave);
  }

  get podeEmitir(): boolean {
    // Aposentado: só os meses que começaram até a data da aposentadoria.
    const aposentadoEm = this.projeto?.aposentadoria?.data;
    return (
      (this.auth.ehEscritorio() || this.auth.ehAdmin()) &&
      this.periodo.ini <= this.emissao &&
      (!aposentadoEm || this.periodo.ini <= aposentadoEm)
    );
  }

  emitir() {
    const id = this.projeto?.id;
    if (!id || this.emitindo) return;
    this.emitindo = true;
    this.erroEmissao = '';
    this.retratoService.emitir(id, this.periodo.ini).subscribe({
      next: (r) => {
        this.retratos = [r, ...this.retratos.filter((x) => x.id !== r.id)];
        this.emitindo = false;
      },
      error: (e) => {
        this.emitindo = false;
        this.erroEmissao = mensagemDeErro(e, 'o relatório');
      },
    });
  }

  // Data de referência: o fim do mês, ou hoje se ele ainda não acabou.
  private get referencia(): string {
    return this.periodo.fim < this.emissao ? this.periodo.fim : this.emissao;
  }

  // ---- Série histórica ----
  // Os gráficos leem só o que foi emitido, um ponto por mês. Um ponto sozinho
  // não é tendência: abaixo de dois meses não há gráfico.
  private get serie(): Retrato[] {
    return [...this.vigentes.entries()]
      .filter(([mes]) => mes <= this.periodo.chave)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, r]) => r);
  }

  get temSerie(): boolean {
    return this.serie.length >= 2;
  }

  get rotulosSerie(): string[] {
    return this.serie.map((r) => {
      const [ano, mes] = mesDo(r).split('-');
      return `${MESES[Number(mes) - 1]}/${ano.slice(2)}`;
    });
  }

  private daSerie(metrica: Metrica): (number | null)[] {
    return this.serie.map((r) => valor(r, metrica));
  }

  get serieAvanco(): SerieGrafico[] {
    return [
      { nome: 'Realizado', cor: 1, estilo: 'realizado', valores: this.daSerie('PERCENTUAL_CONCLUIDO') },
      { nome: 'Planejado', cor: 'neutra', estilo: 'planejado', valores: this.daSerie('PERCENTUAL_ESPERADO') },
    ];
  }

  get serieIndices(): SerieGrafico[] {
    return [
      { nome: 'IDP · prazo', cor: 1, estilo: 'realizado', valores: this.daSerie('IDP') },
      { nome: 'IDC · custo', cor: 2, estilo: 'realizado', valores: this.daSerie('IDC') },
    ];
  }

  // O realizado sai dos gastos lançados mês a mês: corrigir um mês corrige o gráfico.
  // Sem gasto lançado, vale o que o retrato congelou.
  private get realizadoDaSerie(): (number | null)[] {
    if (!this.gastos.length) return this.daSerie('REALIZADO');
    return this.serie.map((r) => acumuladoAte(this.gastos, mesDo(r)));
  }

  get serieOrcamento(): SerieGrafico[] {
    return [
      { nome: 'Realizado', cor: 1, estilo: 'realizado', valores: this.realizadoDaSerie },
      { nome: 'Orçado', cor: 'neutra', estilo: 'planejado', valores: this.daSerie('ORCADO') },
    ];
  }

  get temOrcamento(): boolean {
    return this.realizadoDaSerie.some((v) => v != null && v > 0);
  }

  // O plano vale 1; a faixa aceita 10% para cada lado.
  readonly faixaIndices = { de: 1 - TOLERANCIA_DESVIO / 100, ate: 1 + TOLERANCIA_DESVIO / 100 };

  get periodoSerie(): string {
    const primeira = this.rotulosSerie[0];
    return primeira ? `${primeira} a ${this.rotulosSerie.at(-1)}` : '';
  }

  // Valor congelado do documento emitido; null na prévia.
  private congelado(metrica: Metrica): number | null {
    return valor(this.retrato, metrica);
  }

  metaDe(metrica: Metrica): number | null {
    return meta(this.retrato, metrica);
  }

  get estado(): Estado {
    return (this.projeto && analisarProjeto(this.projeto)?.estado) || 'A_INICIAR';
  }

  get rotuloEstado(): string {
    return ROTULO_ESTADO[this.estado];
  }

  get iconeEstado(): string {
    return ICONE_ESTADO[this.estado];
  }

  get avanco(): number {
    const congelado = this.congelado('PERCENTUAL_CONCLUIDO');
    if (congelado != null) return congelado;
    return this.projeto ? progressoProjeto(this.projeto) : 0;
  }

  get esperado(): number | null {
    if (this.emitido) return this.congelado('PERCENTUAL_ESPERADO');
    const f = this.projeto ? fracaoDecorrida(this.projeto) : null;
    return f == null ? null : Math.round(f * 100);
  }

  get indices() {
    if (this.emitido) return { idp: this.congelado('IDP'), idc: this.congelado('IDC') };
    return this.projeto ? calcularDesvio(this.projeto) : null;
  }

  get fasesConcluidas(): number | null {
    return this.congelado('FASES_CONCLUIDAS');
  }

  get fasesTotal(): number | null {
    return this.congelado('FASES_TOTAL');
  }

  get atividadesAbertas(): number | null {
    return this.congelado('ATIVIDADES_ABERTAS');
  }

  get atividadesAtrasadas(): number | null {
    return this.congelado('ATIVIDADES_ATRASADAS');
  }

  // Índice tão fora do plano que a causa provável é a linha de base, não a execução.
  baseARevisar(indice: number | null | undefined): boolean {
    return !basePlausivel(indice);
  }

  get algumIndiceImplausivel(): boolean {
    return this.baseARevisar(this.indices?.idp) || this.baseARevisar(this.indices?.idc);
  }

  // Meses emitidos com o mesmo avanço não desenham tendência: a linha seria reta
  // por falta de história, não por estabilidade do projeto.
  get serieSemVariacao(): boolean {
    const avancos = this.daSerie('PERCENTUAL_CONCLUIDO').filter((v) => v != null);
    return avancos.length > 1 && new Set(avancos).size === 1;
  }

  // Índice fora da tolerância de 10% para baixo.
  abaixo(indice: number | null | undefined): boolean {
    return indice != null && indice < 1 - TOLERANCIA_DESVIO / 100;
  }

  // Narrativa: do documento emitido quando ele existe, do projeto enquanto é prévia.
  get atualizacoesDoPeriodo(): Atualizacao[] {
    const congelado = this.retrato?.andamento;
    if (congelado != null) {
      return congelado.split('\n').map((linha, i) => {
        const [, data, autor, texto] = /^(\d{4}-\d{2}-\d{2}) · ([^:]*): (.*)$/.exec(linha) ?? [];
        return { id: `${i}`, data: data ?? '', autor: autor ?? '', texto: texto ?? linha } as Atualizacao;
      });
    }
    if (this.emitido) return [];
    return (this.projeto?.atualizacoes ?? []).filter((a) => a.data >= this.periodo.ini && a.data <= this.periodo.fim);
  }

  // Identificador curto do documento: projeto, mês e emissão.
  get identificador(): string {
    const mes = this.periodo.chave.replace('-', '');
    const emissao = this.retrato ? this.retrato.id.slice(0, 6).toUpperCase() : 'PREVIA';
    return `${this.projeto?.sigla ?? '—'}-${mes}-${emissao}`;
  }

  // Mês sem nada registrado: uma linha resolve, três negativas não.
  get semNarrativa(): boolean {
    return !this.atualizacoesDoPeriodo.length && !this.pontoAtencao && !this.recomendacao;
  }

  get pontoAtencao(): string {
    return (this.emitido ? this.retrato?.pontoAtencao : this.projeto?.pontoAtencao) || '';
  }

  get recomendacao(): string {
    return (this.emitido ? this.retrato?.recomendacao : this.projeto?.recomendacao) || '';
  }

  get fases() {
    const p = this.projeto;
    if (!p) return [];
    const analise = analisarProjeto(p);
    return (p.fases ?? []).map((f, i) => ({
      fase: f,
      situacao: situacaoFase(p, i) as SituacaoFase,
      estado: analise?.estados[i],
    }));
  }

  private get atividades(): AtividadeNaFase[] {
    return (this.projeto?.fases ?? []).flatMap((f) => (f.atividades ?? []).map((atividade) => ({ atividade, fase: f.nome })));
  }

  get atrasadas(): AtividadeNaFase[] {
    const ref = this.referencia;
    return this.atividades
      .filter(({ atividade: a }) => a.situacao !== 'CONCLUIDA' && !!a.prazo && a.prazo < ref)
      .sort((x, y) => x.atividade.prazo!.localeCompare(y.atividade.prazo!));
  }

  get proximas(): AtividadeNaFase[] {
    const ref = this.referencia;
    const [a, m, d] = ref.split('-').map(Number);
    const limite = iso(new Date(a, m - 1, d + HORIZONTE_DIAS));
    return this.atividades
      .filter(({ atividade: x }) => x.situacao !== 'CONCLUIDA' && !!x.prazo && x.prazo >= ref && x.prazo <= limite)
      .sort((x, y) => x.atividade.prazo!.localeCompare(y.atividade.prazo!));
  }

  readonly horizonte = HORIZONTE_DIAS;

  rotuloSituacao(s: SituacaoFase): string {
    return { PENDENTE: 'Pendente', EM_ANDAMENTO: 'Em andamento', CONCLUIDA: 'Concluída' }[s];
  }

  data(valor?: string | null): string {
    if (!valor) return '—';
    const [a, m, d] = valor.split('-');
    return `${d}/${m}/${a}`;
  }

  dataCurta(valor?: string | null): string {
    if (!valor) return '—';
    const [, m, d] = valor.split('-');
    return `${d}/${m}`;
  }

  indice(valor: number | null | undefined): string {
    return valor == null ? '—' : valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
