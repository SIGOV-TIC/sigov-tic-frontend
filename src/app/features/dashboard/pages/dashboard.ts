import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { catchError, forkJoin, of } from 'rxjs';
import { ProjetoResponse } from '../../projetos/models/projeto';
import { ProjetoService } from '../../projetos/services/projeto.service';
import { analisarProjeto, Estado, ORDEM_ESTADOS, progressoProjeto } from '../../projetos/utils/saude';
import { analisarCusto, SituacaoCusto } from '../../projetos/utils/custo';
import { moedaCompacta } from '../../projetos/utils/moeda';
import { Meta, MetaService } from '../../objetivos/services/meta.service';
import { avaliarMeta } from '../../objetivos/utils/meta';
import { situacaoFase } from '../../projetos/utils/fase';
import { Retrato, RetratoService } from '../services/retrato.service';

type Gravidade = 'grave' | 'atencao';

// Um item fora do previsto, venha do prazo, do custo ou de uma meta.
interface Alerta {
  tipo: 'Prazo' | 'Custo' | 'Meta';
  gravidade: Gravidade;
  titulo: string;
  sigla?: string;
  // Objetivo da meta: o mesmo indicador pode aparecer em mais de um.
  objetivo?: string;
  motivo: string;
  responsavel?: string;
  link: unknown[];
  query?: Record<string, string>;
}

// Um quadradinho do panorama: um projeto ou uma meta.
interface Unidade {
  rotulo: string;
  classe: 'ok' | 'concluido' | 'grave' | 'atencao' | 'vazio';
  link: unknown[];
  query?: Record<string, string>;
}

interface LinhaPanorama {
  chave: 'prazo' | 'custo' | 'metas';
  nome: string;
  ok: number;
  total: number;
  unidade: string;
  situacao: string;
  unidades: Unidade[];
  resumo: string;
  link: string;
}

// Fase ou meta que vence nos próximos dias.
interface Vencimento {
  data: Date;
  tipo: 'Fase' | 'Meta';
  titulo: string;
  sub: string;
  link: unknown[];
  query?: Record<string, string>;
}

// Comparação com o retrato mais antigo dentro da janela.
interface Variacao {
  delta: number;
  desde: string;
  serie: number[];
}

const DIAS_PROXIMOS = 30;

@Component({
  // Dados chegam da API depois da renderização; sem Eager a tela não atualiza.
  changeDetection: ChangeDetectionStrategy.Eager,
  selector: 'app-dashboard',
  imports: [RouterLink, MatIconModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  projetos: ProjetoResponse[] = [];
  metas: Meta[] = [];
  retratos: Retrato[] = [];
  carregando = true;
  erro = false;

  readonly hoje = new Date();

  constructor(
    private projetoService: ProjetoService,
    private metaService: MetaService,
    private retratoService: RetratoService,
  ) {}

  ngOnInit() {
    this.projetoService.seedSeNecessario();
    forkJoin({
      projetos: this.projetoService.listar(0, 100),
      metas: this.metaService.listar(),
      // Sem histórico o painel funciona igual, só não mostra a tendência.
      retratos: this.retratoService.listar().pipe(catchError(() => of([] as Retrato[]))),
    }).subscribe({
      next: ({ projetos, metas, retratos }) => {
        this.projetos = projetos.content.filter((p) => p.status !== 'REJEITADO');
        this.metas = metas;
        this.retratos = retratos;
        this.carregando = false;
        this.registrarRetrato();
      },
      error: () => {
        this.carregando = false;
        this.erro = true;
      },
    });
  }

  get dataHoje(): string {
    const texto = this.hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  // ---- O que precisa de atenção ----

  get alertas(): Alerta[] {
    const lista: Alerta[] = [];

    this.projetos.forEach((p) => {
      const a = analisarProjeto(p);
      if (a && (a.estado === 'ATRASADO' || a.estado === 'RISCO')) {
        lista.push({
          tipo: 'Prazo',
          gravidade: a.estado === 'ATRASADO' ? 'grave' : 'atencao',
          titulo: p.nome,
          sigla: p.sigla,
          motivo: this.motivoPrazo(p),
          responsavel: p.gerenteResponsavel,
          link: ['/cronograma'],
        });
      }
      const c = analisarCusto(p);
      if (c && c.situacao !== 'OK') {
        lista.push({
          tipo: 'Custo',
          gravidade: c.situacao === 'ESTOURADO' ? 'grave' : 'atencao',
          titulo: p.nome,
          sigla: p.sigla,
          motivo:
            c.situacao === 'ESTOURADO'
              ? `Gastou ${moedaCompacta(c.gasto - c.orcado)} além do orçado.`
              : `Gastou ${c.pctGasto}% do orçado com ${c.avanco}% de avanço.`,
          responsavel: p.gerenteResponsavel,
          link: ['/orcamento'],
        });
      }
    });

    this.metas.forEach((m) => {
      const av = avaliarMeta(m);
      if (!av.foraDoRitmo) return;
      const n = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: Math.abs(v) < 10 ? 1 : 0 });
      lista.push({
        tipo: 'Meta',
        gravidade: av.estado === 'ATRASADO' ? 'grave' : 'atencao',
        titulo: m.indicador,
        objetivo: m.objetivo,
        motivo:
          av.estado === 'ATRASADO'
            ? av.motivo
            : `Está em ${n(m.valorAtual!)}${m.unidade === '%' ? '%' : ''}; pelo tempo decorrido, deveria estar em ${n(av.valorEsperado)}${m.unidade === '%' ? '%' : ''}.`,
        responsavel: m.responsavel,
        link: ['/objetivos'],
        query: { abrir: m.objetivo },
      });
    });

    const peso = (a: Alerta) => (a.gravidade === 'grave' ? 0 : 1);
    const ordemTipo = { Prazo: 0, Custo: 1, Meta: 2 };
    return lista.sort((a, b) => peso(a) - peso(b) || ordemTipo[a.tipo] - ordemTipo[b.tipo]);
  }

  // Por que o projeto está atrasado ou em risco, em uma frase.
  private motivoPrazo(p: ProjetoResponse): string {
    const a = analisarProjeto(p)!;
    const fases = p.fases ?? [];
    const i = a.estados.findIndex((e) => e === a.estado);
    if (i < 0) return a.estado === 'ATRASADO' ? 'Marcado como atrasado no cadastro.' : 'Marcado em atenção no cadastro.';
    const nome = fases[i].nome;
    const janela = a.janelas[i];
    const data = (pos: number) => this.dataDePosicao(pos).toLocaleDateString('pt-BR');
    if (a.estado === 'ATRASADO') {
      if (i !== a.atual) return `A fase ${nome} deveria ter começado em ${data(janela.ini)}.`;
      if (a.posHoje > janela.fim) return `O prazo da fase ${nome} venceu em ${data(janela.fim - 1 / 30)}.`;
      return `Marcado como atrasado no cadastro; fase atual: ${nome}.`;
    }
    const tempo = Math.round(((a.posHoje - janela.ini) / (janela.fim - janela.ini)) * 100);
    const perc = fases[i].percentual;
    return perc != null ? `Fase ${nome} em ${perc}%; pelo tempo, o esperado seria ${tempo}%.` : `Fase ${nome} com andamento abaixo do esperado.`;
  }

  private dataDePosicao(pos: number): Date {
    const ano = Math.floor(pos / 12);
    const mes = Math.floor(pos) % 12;
    const dias = new Date(ano, mes + 1, 0).getDate();
    return new Date(ano, mes, 1 + Math.floor((pos - Math.floor(pos)) * dias));
  }

  get graves(): number {
    return this.alertas.filter((a) => a.gravidade === 'grave').length;
  }

  // ---- Panorama: cada projeto ou meta como um quadradinho ----

  get panorama(): LinhaPanorama[] {
    const ordem = (e: Estado) => ORDEM_ESTADOS.indexOf(e);
    const prazo = this.projetos
      .map((p) => ({ p, estado: analisarProjeto(p)?.estado ?? null }))
      .sort((x, y) => (x.estado ? ordem(x.estado) : 9) - (y.estado ? ordem(y.estado) : 9));
    const noPrazo = prazo.filter((x) => x.estado && x.estado !== 'ATRASADO' && x.estado !== 'RISCO').length;

    const ordemCusto: Record<SituacaoCusto, number> = { ESTOURADO: 0, ALERTA: 1, OK: 2 };
    const custo = this.projetos
      .map((p) => ({ p, c: analisarCusto(p) }))
      .sort((x, y) => (x.c ? ordemCusto[x.c.situacao] : 9) - (y.c ? ordemCusto[y.c.situacao] : 9));
    const comOrcamento = custo.filter((x) => x.c);
    const custoOk = comOrcamento.filter((x) => x.c!.situacao === 'OK').length;

    const metas = this.metas.map((m) => ({ m, av: avaliarMeta(m) })).sort((x, y) => ordem(x.av.estado) - ordem(y.av.estado));
    const metasOk = metas.filter((x) => !x.av.foraDoRitmo).length;

    const classePrazo = (e: Estado | null): Unidade['classe'] =>
      !e ? 'vazio' : e === 'ATRASADO' ? 'grave' : e === 'RISCO' ? 'atencao' : e === 'CONCLUIDO' ? 'concluido' : 'ok';

    return [
      {
        chave: 'prazo',
        nome: 'Prazo',
        link: '/cronograma',
        ok: noPrazo,
        total: prazo.length,
        unidade: 'projetos',
        situacao: 'no prazo',
        resumo: `${noPrazo} de ${prazo.length} projetos no prazo`,
        unidades: prazo.map(({ p, estado }) => ({
          rotulo: `${p.sigla}: ${estado ? this.rotulo(estado) : 'sem cronograma'}`,
          classe: classePrazo(estado),
          link: ['/projeto', p.id],
        })),
      },
      {
        chave: 'custo',
        nome: 'Custo',
        link: '/orcamento',
        ok: custoOk,
        total: comOrcamento.length,
        unidade: 'projetos',
        situacao: 'dentro do previsto',
        resumo: `${custoOk} de ${comOrcamento.length} projetos dentro do previsto`,
        unidades: custo.map(({ p, c }) => ({
          rotulo: `${p.sigla}: ${!c ? 'sem orçamento' : c.situacao === 'OK' ? `${c.pctGasto}% gasto, ${c.avanco}% de avanço` : c.situacao === 'ESTOURADO' ? 'acima do orçado' : 'gasto à frente do avanço'}`,
          classe: !c ? 'vazio' : c.situacao === 'ESTOURADO' ? 'grave' : c.situacao === 'ALERTA' ? 'atencao' : 'ok',
          link: ['/projeto', p.id],
        })),
      },
      {
        chave: 'metas',
        nome: 'Metas',
        link: '/objetivos',
        ok: metasOk,
        total: metas.length,
        unidade: 'metas',
        situacao: 'no ritmo',
        resumo: `${metasOk} de ${metas.length} metas no ritmo`,
        unidades: metas.map(({ m, av }) => ({
          rotulo: `${m.indicador}: ${av.motivo.replace(/\.$/, '').toLowerCase()}`,
          classe: av.estado === 'ATRASADO' ? 'grave' : av.estado === 'RISCO' ? 'atencao' : av.estado === 'CONCLUIDO' ? 'concluido' : av.atingido === null ? 'vazio' : 'ok',
          link: ['/objetivos'],
          query: { abrir: m.objetivo },
        })),
      },
    ];
  }

  // ---- Tendência ----

  // Grava a leitura de hoje; o histórico nasce daqui.
  private registrarRetrato() {
    const [prazo, custo, metas] = this.panorama;
    this.retratoService
      .registrarHoje({
        prazoOk: prazo.ok,
        prazoTotal: prazo.total,
        custoOk: custo.ok,
        custoTotal: custo.total,
        metasOk: metas.ok,
        metasTotal: metas.total,
        alertas: this.alertas.length,
      })
      .pipe(catchError(() => of(null)))
      .subscribe();
  }

  private hojeIso(): string {
    const d = this.hoje;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // Variação de "quantos no previsto" contra o dia mais próximo de 30 dias atrás.
  variacao(l: LinhaPanorama): Variacao | null {
    const anteriores = this.retratos.filter((r) => r.data < this.hojeIso());
    if (!anteriores.length) return null;
    const limite = new Date(this.hoje.getTime() - 30 * 86400000);
    const base = [...anteriores].reverse().find((r) => this.lerData(r.data) <= limite) ?? anteriores[0];
    const ok = { prazo: base.prazoOk, custo: base.custoOk, metas: base.metasOk }[l.chave];
    const serie = [...anteriores.map((r) => ({ prazo: r.prazoOk, custo: r.custoOk, metas: r.metasOk })[l.chave]), l.ok];
    return {
      delta: l.ok - ok,
      desde: this.lerData(base.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      serie,
    };
  }

  // Pontos de uma linha pequena (120 x 24) com a série.
  linha(serie: number[]): string {
    const max = Math.max(...serie, 1);
    const min = Math.min(...serie, 0);
    const passo = serie.length > 1 ? 120 / (serie.length - 1) : 0;
    return serie.map((v, i) => `${(i * passo).toFixed(1)},${(22 - ((v - min) / (max - min || 1)) * 20).toFixed(1)}`).join(' ');
  }

  private lerData(iso: string): Date {
    const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
    return new Date(a, m - 1, d);
  }

  // ---- Próximos vencimentos ----

  get proximos(): Vencimento[] {
    const inicio = new Date(this.hoje.getFullYear(), this.hoje.getMonth(), this.hoje.getDate());
    const limite = new Date(inicio.getTime() + DIAS_PROXIMOS * 86400000);
    const lista: Vencimento[] = [];

    this.projetos.forEach((p) => {
      const a = analisarProjeto(p);
      (p.fases ?? []).forEach((f, i) => {
        if (situacaoFase(p, i) === 'CONCLUIDA') return;
        const fim = f.dataFim ? this.lerData(f.dataFim) : a ? this.dataDePosicao(a.janelas[i].fim - 1 / 30) : null;
        if (fim && fim >= inicio && fim <= limite) {
          lista.push({ data: fim, tipo: 'Fase', titulo: f.nome, sub: `${p.sigla} · ${p.nome}`, link: ['/projeto', p.id] });
        }
      });
    });

    this.metas.forEach((m) => {
      const prazo = this.lerData(m.prazo);
      if (prazo >= inicio && prazo <= limite && avaliarMeta(m).estado !== 'CONCLUIDO') {
        lista.push({ data: prazo, tipo: 'Meta', titulo: m.indicador, sub: m.objetivo, link: ['/objetivos'], query: { abrir: m.objetivo } });
      }
    });

    return lista.sort((a, b) => a.data.getTime() - b.data.getTime());
  }

  dia(d: Date): string {
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  emDias(d: Date): string {
    const inicio = new Date(this.hoje.getFullYear(), this.hoje.getMonth(), this.hoje.getDate());
    const n = Math.round((d.getTime() - inicio.getTime()) / 86400000);
    return n === 0 ? 'hoje' : n === 1 ? 'amanhã' : `em ${n} dias`;
  }

  private rotulo(e: Estado): string {
    return { ATRASADO: 'atrasado', RISCO: 'em risco', ANDAMENTO: 'em andamento', A_INICIAR: 'a iniciar', CONCLUIDO: 'concluído' }[e];
  }

  // ---- Contexto ----

  get emAndamento(): number {
    return this.projetos.filter((p) => {
      const e = analisarProjeto(p)?.estado;
      return e && e !== 'CONCLUIDO' && e !== 'A_INICIAR';
    }).length;
  }

  get concluidos(): number {
    return this.projetos.filter((p) => analisarProjeto(p)?.estado === 'CONCLUIDO').length;
  }

  get orcado(): number {
    return this.projetos.reduce((a, p) => a + (p.orcamentoEstimado || 0), 0);
  }

  get gasto(): number {
    return this.projetos.reduce((a, p) => a + (p.custoRealizado || 0), 0);
  }

  get avancoMedio(): number {
    const comFases = this.projetos.filter((p) => (p.fases ?? []).length > 0);
    return comFases.length ? Math.round(comFases.reduce((a, p) => a + progressoProjeto(p), 0) / comFases.length) : 0;
  }

  moeda(v: number): string {
    return moedaCompacta(v);
  }

  iniciais(nome?: string): string {
    const partes = (nome ?? '').trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return '';
    return ((partes[0][0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
  }

  recarregar() {
    location.reload();
  }
}
