import { ChangeDetectionStrategy, Component, computed, EventEmitter, inject, Input, OnChanges, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ProjetoResponse } from '../../../projetos/models/projeto';
import { GraficoTendencia, SerieGrafico } from '../../../../shared/grafico/grafico-tendencia';
import { SomenteNumero } from '../../../../shared/numero/somente-numero';
import { Escolha } from '../../../../shared/escolha/escolha';
import { mensagemDeErro } from '../../../../shared/estado/erro-api';
import { Gasto, GastoRequest } from '../../models/gasto';
import { GastoService } from '../../services/gasto.service';
import { linhaDoTempo, mesAtual, proximoMes, rotuloMes } from '../../utils/linha-do-tempo';

interface Rascunho extends GastoRequest {
  id?: string;
}

// Meses oferecidos no formulário além dos que o projeto já cobre.
const MESES_PARA_TRAS = 24;

@Component({
  selector: 'app-realizado-mensal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatIconModule, GraficoTendencia, SomenteNumero, Escolha],
  templateUrl: './realizado-mensal.html',
  styleUrl: './realizado-mensal.scss',
})
export class RealizadoMensal implements OnChanges {
  @Input({ required: true }) projeto!: ProjetoResponse;
  @Input() podeEditar = false;
  // Novo realizado do projeto (soma dos gastos) depois de cada gravação.
  @Output() realizado = new EventEmitter<number>();

  private readonly service = inject(GastoService);

  readonly gastos = signal<Gasto[]>([]);
  readonly origens = signal<string[]>([]);
  readonly carregando = signal(true);
  readonly erro = signal('');
  readonly rascunho = signal<Rascunho | null>(null);
  readonly salvando = signal(false);

  readonly linhas = computed(() => linhaDoTempo(this.gastos(), mesAtual()));
  // Mais recente primeiro; só os meses com gasto.
  readonly mesesComGasto = computed(() => this.linhas().filter((l) => l.gastos.length).reverse());

  // A tela abre na situação de agora; os meses anteriores ficam atrás do histórico.
  readonly verHistorico = signal(false);
  readonly atual = computed(() => this.linhas().at(-1) ?? null);
  readonly mesesVisiveis = computed(() => {
    const meses = this.mesesComGasto();
    return this.verHistorico() ? meses : meses.filter((l) => l.mes === mesAtual());
  });
  readonly mesesAnteriores = computed(() => this.mesesComGasto().filter((l) => l.mes !== mesAtual()).length);

  pctDoOrcado(valor: number): number | null {
    const orcado = this.projeto?.orcamentoEstimado;
    return orcado ? Math.round((valor / orcado) * 100) : null;
  }

  readonly rotulos = computed(() => this.linhas().map((l) => rotuloMes(l.mes, true)));
  readonly series = computed<SerieGrafico[]>(() => {
    const series: SerieGrafico[] = [
      { nome: 'Realizado acumulado', cor: 1, estilo: 'realizado', valores: this.linhas().map((l) => l.acumulado) },
    ];
    const orcado = this.projeto?.orcamentoEstimado;
    if (orcado) series.push({ nome: 'Orçado', cor: 'neutra', estilo: 'planejado', valores: this.linhas().map(() => orcado) });
    return series;
  });

  private carregadoPara = '';

  ngOnChanges() {
    if (!this.projeto?.id || this.projeto.id === this.carregadoPara) return;
    this.carregadoPara = this.projeto.id;
    this.carregar();
  }

  carregar() {
    this.carregando.set(true);
    this.service.doProjeto(this.projeto.id).subscribe({
      next: (g) => {
        this.gastos.set(g);
        this.carregando.set(false);
      },
      error: (e) => {
        this.erro.set(mensagemDeErro(e, 'o realizado'));
        this.carregando.set(false);
      },
    });
  }

  // Do mês corrente para trás, cobrindo o início do projeto e o gasto mais antigo.
  get mesesDisponiveis(): string[] {
    const atual = mesAtual();
    const candidatos = [this.projeto?.dataInicioPrevista?.slice(0, 7), ...this.gastos().map((g) => g.mes)].filter(
      (m): m is string => !!m && m <= atual,
    );
    const [a, m] = atual.split('-').map(Number);
    const recuo = new Date(a, m - 1 - MESES_PARA_TRAS, 1);
    let inicio = mesAtual(recuo);
    candidatos.forEach((c) => (inicio = c < inicio ? c : inicio));
    const meses: string[] = [];
    for (let mes = inicio; mes <= atual; mes = proximoMes(mes)) meses.push(mes);
    return meses.reverse();
  }

  rotulo(mes: string) {
    return rotuloMes(mes);
  }

  moeda(valor: number): string {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: Number.isInteger(valor) ? 0 : 2 });
  }

  novo() {
    this.abrir({ mes: mesAtual(), valor: null as unknown as number, motivo: '', origem: '' });
  }

  editar(g: Gasto) {
    this.abrir({ id: g.id, mes: g.mes, valor: g.valor, motivo: g.motivo, origem: g.origem });
  }

  private abrir(r: Rascunho) {
    this.erro.set('');
    this.rascunho.set(r);
    if (!this.origens().length) this.service.origens().subscribe((o) => this.origens.set(o));
  }

  cancelar() {
    this.rascunho.set(null);
    this.erro.set('');
  }

  completo(r: Rascunho): boolean {
    return !!r.mes && Number(r.valor) > 0 && !!r.motivo?.trim() && !!r.origem?.trim();
  }

  salvar() {
    const r = this.rascunho();
    if (!r || !this.completo(r) || this.salvando()) return;
    const corpo: GastoRequest = { mes: r.mes, valor: Number(r.valor), motivo: r.motivo.trim(), origem: r.origem.trim() };
    const pedido = r.id ? this.service.atualizar(this.projeto.id, r.id, corpo) : this.service.criar(this.projeto.id, corpo);
    this.salvando.set(true);
    pedido.subscribe({
      next: (salvo) => {
        this.gastos.update((lista) => [...lista.filter((g) => g.id !== salvo.id), salvo]);
        if (!this.origens().includes(salvo.origem)) this.origens.update((o) => [...o, salvo.origem].sort());
        this.rascunho.set(null);
        this.salvando.set(false);
        this.avisar();
      },
      error: (e) => {
        this.erro.set(mensagemDeErro(e, 'o gasto'));
        this.salvando.set(false);
      },
    });
  }

  remover(g: Gasto) {
    if (!confirm(`Remover o gasto de ${this.moeda(g.valor)} em ${this.rotulo(g.mes)}?`)) return;
    this.service.remover(this.projeto.id, g.id).subscribe({
      next: () => {
        this.gastos.update((lista) => lista.filter((x) => x.id !== g.id));
        this.avisar();
      },
      error: (e) => this.erro.set(mensagemDeErro(e, 'o gasto')),
    });
  }

  private avisar() {
    this.realizado.emit(this.gastos().reduce((s, g) => s + g.valor, 0));
  }
}
