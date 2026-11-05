import { ChangeDetectionStrategy, Component, ElementRef, Input, OnDestroy, signal, viewChild } from '@angular/core';
import { AfterViewInit } from '@angular/core';

// Notação: realizado é linha cheia, planejado é linha de contorno (traço fino e claro),
// previsão é hachurada. Cor só entra onde o valor sai do esperado.
export type EstiloSerie = 'realizado' | 'planejado';

export interface SerieGrafico {
  nome: string;
  valores: (number | null)[];
  // Posição na paleta; 'neutra' é o cinza do plano.
  cor: 1 | 2 | 'neutra';
  estilo?: EstiloSerie;
}

export interface FaixaGrafico {
  de: number;
  ate: number;
}

export type FormatoValor = 'percentual' | 'moeda' | 'indice';

interface Ponto {
  x: number;
  y: number;
  valor: number;
}

interface SerieDesenhada {
  serie: SerieGrafico;
  pontos: Ponto[];
  caminho: string;
  fim: Ponto | null;
}

// Menor passo redondo (1, 2, 2,5 ou 5 vezes uma potência de dez) que cobre a
// amplitude em até quatro marcas. Sem isto o eixo sobra muito acima dos dados.
function passoRedondo(amplitude: number): number {
  if (!(amplitude > 0)) return 1;
  const potencia = 10 ** Math.floor(Math.log10(amplitude / 3));
  for (const fator of [1, 2, 2.5, 5, 10, 20]) {
    const passo = fator * potencia;
    if (Math.ceil(amplitude / passo) <= 4) return passo;
  }
  return amplitude / 3;
}

const ALTURA = 220;
const MARGEM = { topo: 16, direita: 72, baixo: 28, esquerda: 56 };
const LARGURA_MINIMA = 320;

@Component({
  selector: 'app-grafico-tendencia',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './grafico-tendencia.html',
  styleUrl: './grafico-tendencia.scss',
})
export class GraficoTendencia implements AfterViewInit, OnDestroy {
  @Input({ required: true }) titulo = '';
  @Input({ required: true }) rotulos: string[] = [];
  @Input({ required: true }) series: SerieGrafico[] = [];
  @Input() faixa: FaixaGrafico | null = null;
  @Input() referencia: number | null = null;
  @Input() formato: FormatoValor = 'percentual';

  readonly caixa = viewChild.required<ElementRef<HTMLElement>>('caixa');
  readonly largura = signal(720);
  readonly foco = signal<number | null>(null);
  readonly verDados = signal(false);

  readonly altura = ALTURA;
  readonly margem = MARGEM;
  private observador?: ResizeObserver;

  ngAfterViewInit() {
    const el = this.caixa().nativeElement;
    this.largura.set(Math.max(el.clientWidth, LARGURA_MINIMA));
    // Ambientes sem ResizeObserver (testes) ficam na largura inicial.
    if (typeof ResizeObserver === 'undefined') return;
    this.observador = new ResizeObserver(() => this.largura.set(Math.max(el.clientWidth, LARGURA_MINIMA)));
    this.observador.observe(el);
  }

  ngOnDestroy() {
    this.observador?.disconnect();
  }

  // ---- Escalas ----

  private get valores(): number[] {
    const daSerie = this.series.flatMap((s) => s.valores.filter((v): v is number => v != null));
    const extras = [this.referencia, this.faixa?.de, this.faixa?.ate].filter((v): v is number => v != null);
    return [...daSerie, ...extras];
  }

  // Limites em números redondos: as marcas do eixo têm de ser legíveis sozinhas.
  get limites(): { min: number; max: number; passo: number } {
    const valores = this.valores;
    if (!valores.length) return { min: 0, max: 1, passo: 1 };
    const maior = Math.max(...valores);
    const base = this.formato === 'indice' ? Math.min(...valores) : 0;
    const folga = (maior - base) * 0.1 || Math.abs(maior) * 0.1 || 1;
    const provisorio = passoRedondo(maior + folga - (base - folga));
    const min = this.formato === 'indice' ? Math.floor((base - folga) / provisorio) * provisorio : 0;
    // Com o piso definido, o passo é recalculado sobre a amplitude que sobrou.
    const passo = passoRedondo(maior + folga - min);
    const marcas = Math.max(3, Math.ceil((maior + folga - min) / passo));
    return { min, max: min + passo * marcas, passo };
  }

  private x(i: number): number {
    const util = this.largura() - MARGEM.esquerda - MARGEM.direita;
    const passos = Math.max(this.rotulos.length - 1, 1);
    return MARGEM.esquerda + (util * i) / passos;
  }

  private y(valor: number): number {
    const { min, max } = this.limites;
    const util = ALTURA - MARGEM.topo - MARGEM.baixo;
    const fracao = max === min ? 0.5 : (valor - min) / (max - min);
    return MARGEM.topo + util * (1 - fracao);
  }

  get desenhadas(): SerieDesenhada[] {
    return this.series.map((serie) => {
      const pontos: Ponto[] = serie.valores
        .map((valor, i) => (valor == null ? null : { x: this.x(i), y: this.y(valor), valor }))
        .filter((p): p is Ponto => p != null);
      const caminho = pontos.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
      return { serie, pontos, caminho, fim: pontos.at(-1) ?? null };
    });
  }

  // Marcas redondas no eixo vertical, de passo em passo.
  get marcas(): { valor: number; y: number; rotulo: string }[] {
    const { min, max, passo } = this.limites;
    const lista = [];
    for (let valor = min; valor <= max + passo / 2; valor += passo) {
      lista.push({ valor, y: this.y(valor), rotulo: this.eixo(valor) });
    }
    return lista;
  }

  get faixaDesenhada(): { y: number; altura: number } | null {
    if (!this.faixa) return null;
    const topo = this.y(this.faixa.ate);
    return { y: topo, altura: Math.max(this.y(this.faixa.de) - topo, 1) };
  }

  get yReferencia(): number | null {
    return this.referencia == null ? null : this.y(this.referencia);
  }

  get larguraFatia(): number {
    return (this.largura() - MARGEM.esquerda - MARGEM.direita) / Math.max(this.rotulos.length - 1, 1);
  }

  fatiaX(i: number): number {
    return this.x(i) - this.larguraFatia / 2;
  }

  // ---- Interação ----

  apontar(i: number) {
    this.foco.set(i);
  }

  soltar() {
    this.foco.set(null);
  }

  valorEm(serie: SerieGrafico, i: number): number | null {
    return serie.valores[i] ?? null;
  }

  xDe(i: number): number {
    return this.x(i);
  }

  yDe(valor: number): number {
    return this.y(valor);
  }

  // ---- Texto ----

  formatar(valor: number | null): string {
    if (valor == null) return '—';
    if (this.formato === 'percentual') return `${Math.round(valor)}%`;
    if (this.formato === 'indice') return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
  }

  private eixo(valor: number): string {
    if (this.formato === 'percentual') return `${Math.round(valor)}%`;
    if (this.formato === 'indice') return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (Math.abs(valor) >= 1e6) return `${(valor / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
    if (Math.abs(valor) >= 1000) return `${Math.round(valor / 1000)} mil`;
    return valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
  }

  corDe(serie: SerieGrafico): string {
    return serie.cor === 'neutra' ? 'var(--grafico-plano)' : `var(--grafico-serie-${serie.cor})`;
  }

  alternarDados() {
    this.verDados.update((v) => !v);
  }
}
