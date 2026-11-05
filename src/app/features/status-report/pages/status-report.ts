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

// Quinzena do relatório: 1 a 15, ou 16 ao fim do mês.
interface Quinzena {
  chave: string; // 2026-10-2
  ini: string;
  fim: string;
  rotulo: string;
}

interface AtividadeNaFase {
  atividade: Atividade;
  fase: string;
}

// Dias depois do fim da quinzena que entram em "próximas entregas".
const HORIZONTE_DIAS = 15;
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function quinzenaDe(ano: number, mes: number, metade: 1 | 2): Quinzena {
  const ultimo = new Date(ano, mes + 1, 0).getDate();
  const ini = new Date(ano, mes, metade === 1 ? 1 : 16);
  const fim = new Date(ano, mes, metade === 1 ? 15 : ultimo);
  return {
    chave: `${ano}-${mes + 1}-${metade}`,
    ini: iso(ini),
    fim: iso(fim),
    rotulo: `${ini.getDate()} a ${fim.getDate()} de ${MESES[mes]} ${ano}`,
  };
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

  // A quinzena atual e as cinco anteriores.
  readonly quinzenas: Quinzena[] = (() => {
    const hoje = new Date();
    let ano = hoje.getFullYear();
    let mes = hoje.getMonth();
    let metade: 1 | 2 = hoje.getDate() > 15 ? 2 : 1;
    const lista: Quinzena[] = [];
    for (let i = 0; i < 6; i++) {
      lista.push(quinzenaDe(ano, mes, metade));
      if (metade === 2) metade = 1;
      else {
        metade = 2;
        mes -= 1;
        if (mes < 0) {
          mes = 11;
          ano -= 1;
        }
      }
    }
    return lista;
  })();
  quinzena = this.quinzenas[0];
  readonly emissao = iso(new Date());

  // Retratos já emitidos do projeto; o da quinzena escolhida é o documento que vale.
  retratos: Retrato[] = [];
  emitindo = false;
  erroEmissao = '';

  constructor(
    private projetoService: ProjetoService,
    private retratoService: RetratoService,
    private auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit() {
    const params = this.route.snapshot.queryParamMap;
    this.quinzena = this.quinzenas.find((q) => q.chave === params.get('quinzena')) ?? this.quinzenas[0];
    this.projetoService.seedSeNecessario();
    this.projetoService.listar(0, 100).subscribe({
      next: (pagina) => {
        this.projetos = [...pagina.content].sort((a, b) => a.sigla.localeCompare(b.sigla));
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

  mudarQuinzena() {
    this.gravarNaUrl();
  }

  private gravarNaUrl() {
    this.router.navigate([], {
      queryParams: { projeto: this.projeto?.id, quinzena: this.quinzena.chave },
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
    const direita = `${this.emitido ? 'Status Report' : 'Prévia'} · ${this.quinzena.rotulo}`;
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
  }

  // O documento emitido da quinzena escolhida; null enquanto ela é só prévia.
  get retrato(): Retrato | null {
    return this.retratos.find((r) => r.quinzenaInicio === this.quinzena.ini) ?? null;
  }

  get emitido(): boolean {
    return !!this.retrato;
  }

  // Quinzenas que já têm documento emitido, para marcar na lista.
  foiEmitida(q: Quinzena): boolean {
    return this.retratos.some((r) => r.quinzenaInicio === q.ini);
  }

  get podeEmitir(): boolean {
    return (this.auth.ehEscritorio() || this.auth.ehAdmin()) && this.quinzena.ini <= this.emissao;
  }

  emitir() {
    const id = this.projeto?.id;
    if (!id || this.emitindo) return;
    this.emitindo = true;
    this.erroEmissao = '';
    this.retratoService.emitir(id, this.quinzena.ini).subscribe({
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

  // Data de referência: o fim da quinzena, ou hoje se ela ainda não acabou.
  private get referencia(): string {
    return this.quinzena.fim < this.emissao ? this.quinzena.fim : this.emissao;
  }

  // ---- Série histórica ----
  // Os gráficos leem só o que foi emitido, em ordem de quinzena. Um ponto sozinho
  // não é tendência: abaixo de duas quinzenas não há gráfico.
  private get serie(): Retrato[] {
    const porQuinzena = new Map<string, Retrato>();
    for (const r of [...this.retratos].sort((a, b) => a.emitidoEm.localeCompare(b.emitidoEm))) {
      porQuinzena.set(r.quinzenaInicio, r);
    }
    return [...porQuinzena.values()]
      .sort((a, b) => a.quinzenaInicio.localeCompare(b.quinzenaInicio))
      .filter((r) => r.quinzenaInicio <= this.quinzena.ini);
  }

  get temSerie(): boolean {
    return this.serie.length >= 2;
  }

  get rotulosSerie(): string[] {
    return this.serie.map((r) => {
      const [, mes, dia] = r.quinzenaInicio.split('-');
      return `${dia}/${mes}`;
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

  get serieOrcamento(): SerieGrafico[] {
    return [
      { nome: 'Realizado', cor: 1, estilo: 'realizado', valores: this.daSerie('REALIZADO') },
      { nome: 'Orçado', cor: 'neutra', estilo: 'planejado', valores: this.daSerie('ORCADO') },
    ];
  }

  get temOrcamento(): boolean {
    return this.daSerie('REALIZADO').some((v) => v != null && v > 0);
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

  // Quinzenas emitidas com o mesmo avanço não desenham tendência: a linha seria reta
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
    return (this.projeto?.atualizacoes ?? []).filter((a) => a.data >= this.quinzena.ini && a.data <= this.quinzena.fim);
  }

  // Identificador curto do documento: projeto, quinzena e emissão.
  get identificador(): string {
    const quinzena = this.quinzena.ini.replaceAll('-', '');
    const emissao = this.retrato ? this.retrato.id.slice(0, 6).toUpperCase() : 'PREVIA';
    return `${this.projeto?.sigla ?? '—'}-${quinzena}-${emissao}`;
  }

  // Quinzena sem nada registrado: uma linha resolve, três negativas não.
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
