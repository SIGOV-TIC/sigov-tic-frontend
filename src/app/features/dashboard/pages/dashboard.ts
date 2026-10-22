import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { catchError, forkJoin, of } from 'rxjs';
import { ProjetoResponse } from '../../projetos/models/projeto';
import { ProjetoService } from '../../projetos/services/projeto.service';
import { analisarProjeto } from '../../projetos/utils/saude';
import { analisarCusto } from '../../projetos/utils/custo';
import { moedaCompacta } from '../../projetos/utils/moeda';
import { Meta, MetaService } from '../../objetivos/services/meta.service';
import { avaliarMeta } from '../../objetivos/utils/meta';
import { situacaoFase } from '../../projetos/utils/fase';
import { Retrato, RetratoService } from '../services/retrato.service';
import { fatia, Paginacao, paginaNaUrl } from '../../../shared/paginacao/paginacao';

type Gravidade = 'grave' | 'atencao';

// Um item fora do previsto, venha do prazo, do custo ou de uma meta.
interface Alerta {
  tipo: 'Prazo' | 'Custo' | 'Meta';
  gravidade: Gravidade;
  titulo: string;
  sigla?: string;
  // Linha de baixo do título: fase atual do projeto ou objetivo da meta.
  contexto: string;
  // Coluna Situação: o desvio em cima, a referência embaixo.
  situacao: string;
  referencia: string;
  responsavel?: string;
  link: unknown[];
  query?: Record<string, string>;
}

// Um número da faixa do topo; nos de problema, o número é o que está fora do previsto.
interface Indicador {
  nome: string;
  link: string;
  valor: number | string;
  rotulo: string;
  sub: string;
  gravidade: Gravidade | null;
}

// Fase ou meta que vence nos próximos dias.
interface Vencimento {
  data: Date;
  marco: string;
  dono: string;
  sub: string;
  link: unknown[];
  query?: Record<string, string>;
}

const DIAS_PROXIMOS = 30;
const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

@Component({
  // Dados chegam da API depois da renderização; sem Eager a tela não atualiza.
  changeDetection: ChangeDetectionStrategy.Eager,
  selector: 'app-dashboard',
  imports: [RouterLink, MatIconModule, Paginacao],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  projetos: ProjetoResponse[] = [];
  metas: Meta[] = [];
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
    }).subscribe({
      next: ({ projetos, metas }) => {
        this.projetos = projetos.content.filter((p) => p.status !== 'REJEITADO');
        this.metas = metas;
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

  // ---- Faixa do topo ----

  get indicadores(): Indicador[] {
    const prazo = this.projetos.map((p) => analisarProjeto(p)?.estado).filter((e) => !!e);
    const atrasados = prazo.filter((e) => e === 'ATRASADO').length;
    const emRisco = prazo.filter((e) => e === 'RISCO').length;

    const custos = this.projetos.map((p) => analisarCusto(p)).filter((c) => !!c);
    const acima = custos.filter((c) => c.situacao === 'ESTOURADO').length;
    const aFrente = custos.filter((c) => c.situacao === 'ALERTA').length;

    const metas = this.metas.map((m) => avaliarMeta(m));
    const fora = metas.filter((a) => a.foraDoRitmo);
    const vencidas = fora.filter((a) => a.estado === 'ATRASADO').length;

    const de = (n: number, coisa: string) => `de ${n} ${coisa}`;
    return [
      {
        nome: 'Projetos',
        link: '/portfolio',
        valor: this.projetos.length,
        rotulo: '',
        sub: `${this.emAndamento} em andamento · ${this.concluidos} ${this.concluidos === 1 ? 'concluído' : 'concluídos'}`,
        gravidade: null,
      },
      {
        nome: 'Prazo',
        link: '/cronograma',
        valor: atrasados,
        rotulo: atrasados === 1 ? 'atrasado' : 'atrasados',
        sub: emRisco ? `${emRisco} em risco · ${de(prazo.length, 'projetos')}` : de(prazo.length, 'projetos'),
        gravidade: atrasados ? 'grave' : emRisco ? 'atencao' : null,
      },
      {
        nome: 'Custo',
        link: '/orcamento',
        valor: acima,
        rotulo: 'acima do orçado',
        sub: aFrente
          ? `${aFrente} com gasto à frente do avanço`
          : `${moedaCompacta(this.gasto)} de ${moedaCompacta(this.orcado)} executados`,
        gravidade: acima ? 'grave' : aFrente ? 'atencao' : null,
      },
      {
        nome: 'Metas',
        link: '/objetivos',
        valor: fora.length,
        rotulo: 'fora do ritmo',
        sub: de(metas.length, 'metas'),
        gravidade: vencidas ? 'grave' : fora.length ? 'atencao' : null,
      },
    ];
  }

  // ---- O que precisa de atenção ----

  // A contagem e a faixa do topo valem para a lista inteira; a página só recorta o que aparece.
  readonly tamanhoPagina = 8;
  readonly pagina = paginaNaUrl();

  alertasDaPagina(als: Alerta[]): { itens: Alerta[]; atual: number } {
    const atual = this.pagina.em(als.length, this.tamanhoPagina);
    return { itens: fatia(als, atual, this.tamanhoPagina), atual };
  }

  get alertas(): Alerta[] {
    const lista: Alerta[] = [];

    this.projetos.forEach((p) => {
      const a = analisarProjeto(p);
      const fases = p.fases ?? [];
      const faseAtual = a && fases[a.atual] ? `Fase atual: ${fases[a.atual].nome}` : p.areaSolicitante || '';
      if (a && (a.estado === 'ATRASADO' || a.estado === 'RISCO')) {
        lista.push({
          tipo: 'Prazo',
          gravidade: a.estado === 'ATRASADO' ? 'grave' : 'atencao',
          titulo: p.nome,
          sigla: p.sigla,
          contexto: faseAtual,
          ...this.situacaoPrazo(p),
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
          contexto: faseAtual,
          situacao: c.situacao === 'ESTOURADO' ? `${moedaCompacta(c.gasto - c.orcado)} acima` : `${c.pctGasto}% gasto`,
          referencia: c.situacao === 'ESTOURADO' ? `de ${moedaCompacta(c.orcado)} orçados` : `${c.avanco}% de avanço`,
          responsavel: p.gerenteResponsavel,
          link: ['/orcamento'],
        });
      }
    });

    this.metas.forEach((m) => {
      const av = avaliarMeta(m);
      if (!av.foraDoRitmo) return;
      const pct = m.unidade === '%';
      const n = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: Math.abs(v) < 10 ? 1 : 0 }) + (pct ? '%' : '');
      lista.push({
        tipo: 'Meta',
        gravidade: av.estado === 'ATRASADO' ? 'grave' : 'atencao',
        titulo: m.indicador,
        contexto: m.objetivo,
        situacao: pct ? `${n(m.valorAtual!)} realizado` : `Atual ${n(m.valorAtual!)}`,
        referencia: av.estado === 'ATRASADO' ? `prazo venceu em ${this.dia(this.lerData(m.prazo))}` : `${n(av.valorEsperado)} esperado`,
        responsavel: m.responsavel,
        link: ['/objetivos'],
        query: { abrir: m.objetivo },
      });
    });

    const peso = (a: Alerta) => (a.gravidade === 'grave' ? 0 : 1);
    const ordemTipo = { Prazo: 0, Custo: 1, Meta: 2 };
    return lista.sort((a, b) => peso(a) - peso(b) || ordemTipo[a.tipo] - ordemTipo[b.tipo]);
  }

  // Desvio do prazo em duas partes curtas: o que está errado e contra o quê.
  private situacaoPrazo(p: ProjetoResponse): { situacao: string; referencia: string } {
    const a = analisarProjeto(p)!;
    const fases = p.fases ?? [];
    const i = a.estados.findIndex((e) => e === a.estado);
    const atrasado = a.estado === 'ATRASADO';
    if (i < 0) return { situacao: atrasado ? 'Atrasado' : 'Em risco', referencia: 'marcado no cadastro' };
    const nome = fases[i].nome;
    const janela = a.janelas[i];
    if (atrasado) {
      if (i !== a.atual) return { situacao: 'Atrasado', referencia: `${nome} devia ter começado em ${this.dia(this.dataDePosicao(janela.ini))}` };
      if (a.posHoje > janela.fim) return { situacao: 'Atrasado', referencia: `${nome} venceu em ${this.dia(this.dataDePosicao(janela.fim - 1 / 30))}` };
      return { situacao: 'Atrasado', referencia: 'marcado no cadastro' };
    }
    const tempo = Math.round(((a.posHoje - janela.ini) / (janela.fim - janela.ini)) * 100);
    const perc = fases[i].percentual;
    return perc != null
      ? { situacao: `${perc}% concluído`, referencia: `${tempo}% esperado` }
      : { situacao: 'Em risco', referencia: `${nome} abaixo do esperado` };
  }

  private dataDePosicao(pos: number): Date {
    const ano = Math.floor(pos / 12);
    const mes = Math.floor(pos) % 12;
    const dias = new Date(ano, mes + 1, 0).getDate();
    return new Date(ano, mes, 1 + Math.floor((pos - Math.floor(pos)) * dias));
  }

  // ---- Histórico ----

  // Grava a leitura de hoje; é daqui que sai a tendência quando houver semanas de dados.
  private registrarRetrato() {
    const prazo = this.projetos.map((p) => analisarProjeto(p)?.estado).filter((e) => !!e);
    const custos = this.projetos.map((p) => analisarCusto(p)).filter((c) => !!c);
    const metas = this.metas.map((m) => avaliarMeta(m));
    this.retratoService
      .registrarHoje({
        prazoOk: prazo.filter((e) => e !== 'ATRASADO' && e !== 'RISCO').length,
        prazoTotal: prazo.length,
        custoOk: custos.filter((c) => c.situacao === 'OK').length,
        custoTotal: custos.length,
        metasOk: metas.filter((a) => !a.foraDoRitmo).length,
        metasTotal: metas.length,
        alertas: this.alertas.length,
      })
      .pipe(catchError(() => of(null as Retrato | null)))
      .subscribe();
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
          lista.push({ data: fim, marco: f.nome, dono: p.sigla, sub: p.nome, link: ['/projeto', p.id] });
        }
      });
    });

    this.metas.forEach((m) => {
      const prazo = this.lerData(m.prazo);
      if (prazo >= inicio && prazo <= limite && avaliarMeta(m).estado !== 'CONCLUIDO') {
        lista.push({ data: prazo, marco: m.indicador, dono: 'Meta', sub: m.objetivo, link: ['/objetivos'], query: { abrir: m.objetivo } });
      }
    });

    return lista.sort((a, b) => a.data.getTime() - b.data.getTime());
  }

  dia(d: Date): string {
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  diaDoMes(d: Date): string {
    return String(d.getDate()).padStart(2, '0');
  }

  mes(d: Date): string {
    return MESES[d.getMonth()];
  }

  emDias(d: Date): string {
    const inicio = new Date(this.hoje.getFullYear(), this.hoje.getMonth(), this.hoje.getDate());
    const n = Math.round((d.getTime() - inicio.getTime()) / 86400000);
    return n === 0 ? 'hoje' : n === 1 ? 'amanhã' : `em ${n} dias`;
  }

  // ---- Totais ----

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

  iniciais(nome?: string): string {
    const partes = (nome ?? '').trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return '';
    return ((partes[0][0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
  }

  recarregar() {
    location.reload();
  }
}
